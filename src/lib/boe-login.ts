import * as cheerio from "cheerio";
import {
  guessBoeCaptchaCandidates,
  isBoeCaptchaSolverConfigured,
} from "./boe-captcha";
import {
  getLatestBoeEmailOtp,
  isBoeEmailOtpConfigured,
  type BoeEmailOtp,
} from "./boe-email-otp";
import { isBoeSessionActive, type BoeSession } from "./boe-session";

const LOGIN_URL = "https://subastas.boe.es/id/login.php";
const CAPTCHA_URL = "https://subastas.boe.es/libext/showCaptcha.php";
const HOME_URL = "https://subastas.boe.es/reg/index.php";
const OTP_TIMEOUT_MS = 45_000;
const OTP_POLL_INTERVAL_MS = 2_000;
const CAPTCHA_IMAGE_ATTEMPTS = 4;
const CAPTCHA_CANDIDATES_PER_IMAGE = 4;

const BOE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

type CookieJar = Map<string, string>;

interface BoeLoginOptions {
  username?: string;
  password?: string;
  otpTimeoutMs?: number;
  otpPollIntervalMs?: number;
  debug?: boolean;
}

export interface BoeLoginResult extends BoeSession {
  active: boolean;
  authenticatedAt: string;
  otp: Pick<BoeEmailOtp, "code" | "messageId" | "receivedAt" | "subject">;
}

export class BoeLoginError extends Error {
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "BoeLoginError";
    this.details = details;
  }
}

function getCookieHeader(jar: CookieJar): string | undefined {
  if (jar.size === 0) return undefined;
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function mergeCookies(jar: CookieJar, response: Response) {
  const setCookies = response.headers.getSetCookie?.() || [];
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const eqIndex = pair.indexOf("=");
    if (eqIndex <= 0) continue;
    jar.set(pair.slice(0, eqIndex), pair.slice(eqIndex + 1));
  }
}

function getCookieValue(jar: CookieJar, name: string): string | undefined {
  return jar.get(name)?.trim() || undefined;
}

function extractHiddenInputs(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const hidden: Record<string, string> = {};

  $('input[type="hidden"][name]').each((_, element) => {
    const name = $(element).attr("name")?.trim();
    if (!name) return;
    hidden[name] = $(element).attr("value") ?? "";
  });

  return hidden;
}

function extractPageText(html: string): string {
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractLoginError(html: string): string | undefined {
  const pageText = extractPageText(html);
  const match = pageText.match(/ERROR:\s*(.+?)(?:Por favor|Recuerde|$)/i);
  return match?.[1]?.trim() || undefined;
}

function buildDebugDetails(
  html: string,
  response: Response,
  jar: CookieJar
): Record<string, unknown> {
  const $ = cheerio.load(html);
  return {
    status: response.status,
    location: response.headers.get("location"),
    title: $("title").text().trim() || null,
    textSnippet: extractPageText(html).slice(0, 600),
    cookies: Array.from(jar.keys()),
  };
}

function isOtpChallengePage(html: string): boolean {
  const $ = cheerio.load(html);
  if ($('input[name="codVerif"]').length > 0) {
    return true;
  }

  const text = normalizeText(extractPageText(html));
  return (
    text.includes("codigo de verificacion") &&
    text.includes("correo electronico") &&
    text.includes("telefono movil")
  );
}

function isCaptchaChallengePage(html: string): boolean {
  const $ = cheerio.load(html);
  if ($('input[name="captcha"]').length > 0 && $('input[name="namespace"]').length > 0) {
    return true;
  }

  const text = normalizeText(extractPageText(html));
  return (
    text.includes("verificacion de seguridad") &&
    text.includes("codigo de seguridad")
  );
}

async function fetchBinary(
  url: string,
  jar: CookieJar,
  init: RequestInit = {}
): Promise<{ response: Response; base64: string }> {
  const headers: Record<string, string> = {
    ...BOE_HEADERS,
    ...(init.headers as Record<string, string>),
  };
  const cookieHeader = getCookieHeader(jar);
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    redirect: init.redirect ?? "manual",
  });

  mergeCookies(jar, response);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, base64: buffer.toString("base64") };
}

async function advancePastCaptchaChallenge(
  initialHtml: string,
  jar: CookieJar,
  options: BoeLoginOptions = {}
): Promise<{
  html: string;
  response: Response;
  otpTriggeredAt: number;
  attempts: Array<Record<string, unknown>>;
}> {
  if (!isBoeCaptchaSolverConfigured()) {
    throw new BoeLoginError(
      "Falta GEMINI_API_KEY para resolver el CAPTCHA del BOE."
    );
  }

  let currentHtml = initialHtml;
  let currentResponse: Response | undefined;
  const attempts: Array<Record<string, unknown>> = [];

  for (let imageAttempt = 0; imageAttempt < CAPTCHA_IMAGE_ATTEMPTS; imageAttempt += 1) {
    const hiddenInputs = extractHiddenInputs(currentHtml);
    const namespace = hiddenInputs.namespace?.trim();

    if (!namespace || !hiddenInputs.usuario || !hiddenInputs.password) {
      throw new BoeLoginError(
        "No se pudieron extraer los datos ocultos del CAPTCHA del BOE."
      );
    }

    const { base64 } = await fetchBinary(
      `${CAPTCHA_URL}?namespace=${encodeURIComponent(namespace)}&ts=${Date.now()}`,
      jar,
      {
        method: "GET",
        headers: {
          Referer: LOGIN_URL,
        },
      }
    );

    const candidates = await guessBoeCaptchaCandidates(
      base64,
      CAPTCHA_CANDIDATES_PER_IMAGE
    );

    for (const candidate of candidates) {
      const submittedAt = Date.now();
      const captchaForm = new URLSearchParams({
        ...hiddenInputs,
        captcha: candidate,
        enviar: "Enviar",
      });

      const result = await fetchHtml(LOGIN_URL, jar, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://subastas.boe.es",
          Referer: LOGIN_URL,
        },
        body: captchaForm,
      });

      if (isOtpChallengePage(result.html)) {
        return {
          html: result.html,
          response: result.response,
          otpTriggeredAt: submittedAt,
          attempts,
        };
      }

      attempts.push({
        imageAttempt: imageAttempt + 1,
        candidate,
        title: cheerio.load(result.html)("title").text().trim() || null,
        textSnippet: extractPageText(result.html).slice(0, 220),
      });

      currentHtml = result.html;
      currentResponse = result.response;

      if (!isCaptchaChallengePage(result.html)) {
        return {
          html: result.html,
          response: result.response,
          otpTriggeredAt: submittedAt,
          attempts,
        };
      }
    }
  }

  throw new BoeLoginError(
    "No se pudo resolver el CAPTCHA del BOE tras varios intentos.",
    options.debug && currentResponse
      ? {
          ...buildDebugDetails(currentHtml, currentResponse, jar),
          captchaAttempts: attempts,
        }
      : undefined
  );
}

async function waitForFreshLoginOtp(
  previousMessageId: string | undefined,
  startedAt: number,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<BoeEmailOtp> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const otp = await getLatestBoeEmailOtp("login");
    const receivedAt = otp ? Date.parse(otp.receivedAt) : NaN;

    if (
      otp &&
      otp.messageId !== previousMessageId &&
      Number.isFinite(receivedAt) &&
      receivedAt >= startedAt - 5_000
    ) {
      return otp;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("Timeout esperando el OTP de login del BOE por email");
}

async function fetchHtml(
  url: string,
  jar: CookieJar,
  init: RequestInit = {}
): Promise<{ response: Response; html: string }> {
  const headers: Record<string, string> = {
    ...BOE_HEADERS,
    ...(init.headers as Record<string, string>),
  };
  const cookieHeader = getCookieHeader(jar);
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    redirect: init.redirect ?? "manual",
  });

  mergeCookies(jar, response);
  const html = await response.text();
  return { response, html };
}

export function isBoePasswordLoginConfigured(): boolean {
  return Boolean(
    process.env.BOE_LOGIN_USER?.trim() && process.env.BOE_LOGIN_PASSWORD?.trim()
  );
}

export async function loginWithBoePassword(
  options: BoeLoginOptions = {}
): Promise<BoeLoginResult> {
  const username = options.username?.trim() || process.env.BOE_LOGIN_USER?.trim();
  const password = options.password ?? process.env.BOE_LOGIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Missing BOE credentials. Set BOE_LOGIN_USER and BOE_LOGIN_PASSWORD."
    );
  }

  if (!isBoeEmailOtpConfigured()) {
    throw new Error(
      "Missing Gmail OAuth config. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN."
    );
  }

  const jar: CookieJar = new Map();

  await fetchHtml(LOGIN_URL, jar, { method: "GET" });

  const previousOtp = await getLatestBoeEmailOtp("login").catch(() => null);
  const { response: loginStepResponse, html: loginStepHtml } = await fetchHtml(LOGIN_URL, jar, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://subastas.boe.es",
      Referer: LOGIN_URL,
    },
    body: new URLSearchParams({
      usuario: username,
      password,
      conectar: "Conectar",
    }),
  });

  let challengeHtml = loginStepHtml;
  let challengeResponse = loginStepResponse;
  let otpTriggeredAt = Date.now();
  let captchaAttempts: Array<Record<string, unknown>> = [];

  if (isCaptchaChallengePage(challengeHtml)) {
    const solved = await advancePastCaptchaChallenge(challengeHtml, jar, options);
    challengeHtml = solved.html;
    challengeResponse = solved.response;
    otpTriggeredAt = solved.otpTriggeredAt;
    captchaAttempts = solved.attempts;
  }

  if (!isOtpChallengePage(challengeHtml)) {
    throw new BoeLoginError(
      extractLoginError(challengeHtml) || "El login BOE no ha llegado al paso del OTP.",
      options.debug
        ? {
            ...buildDebugDetails(challengeHtml, challengeResponse, jar),
            ...(captchaAttempts.length ? { captchaAttempts } : {}),
          }
        : undefined
    );
  }

  const hiddenInputs = extractHiddenInputs(challengeHtml);
  if (!hiddenInputs.usuario || !hiddenInputs.password || !hiddenInputs.idUsuario) {
    throw new BoeLoginError(
      "No se pudieron extraer los campos ocultos del login BOE.",
      options.debug
        ? {
            ...buildDebugDetails(challengeHtml, challengeResponse, jar),
            ...(captchaAttempts.length ? { captchaAttempts } : {}),
          }
        : undefined
    );
  }

  const otp = await waitForFreshLoginOtp(
    previousOtp?.messageId,
    otpTriggeredAt,
    options.otpTimeoutMs ?? OTP_TIMEOUT_MS,
    options.otpPollIntervalMs ?? OTP_POLL_INTERVAL_MS
  );

  const verifyForm = new URLSearchParams({
    ...hiddenInputs,
    codVerif: otp.code,
    verificar: "Verificar",
  });

  const { response: verifyResponse, html: verifyHtml } = await fetchHtml(
    LOGIN_URL,
    jar,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://subastas.boe.es",
        Referer: LOGIN_URL,
      },
      body: verifyForm,
    }
  );

  let finalHtml = verifyHtml;
  const redirectLocation = verifyResponse.headers.get("location");

  if (redirectLocation) {
    const redirectUrl = new URL(redirectLocation, LOGIN_URL).toString();
    const final = await fetchHtml(redirectUrl, jar, { method: "GET" });
    finalHtml = final.html;
  } else if (!finalHtml.includes("Conectado como:")) {
    const final = await fetchHtml(HOME_URL, jar, { method: "GET" });
    finalHtml = final.html;
  }

  const session: BoeSession = {
    sessId: getCookieValue(jar, "SESSID"),
    simpleSaml: getCookieValue(jar, "SimpleSAML"),
  };

  const active = await isBoeSessionActive(session);
  if (!active) {
    throw new BoeLoginError(
      extractLoginError(finalHtml) ||
        "El login BOE ha terminado, pero la sesión no ha quedado activa.",
      options.debug ? buildDebugDetails(finalHtml, verifyResponse, jar) : undefined
    );
  }

  return {
    ...session,
    active,
    authenticatedAt: new Date().toISOString(),
    otp: {
      code: otp.code,
      messageId: otp.messageId,
      receivedAt: otp.receivedAt,
      subject: otp.subject,
    },
  };
}
