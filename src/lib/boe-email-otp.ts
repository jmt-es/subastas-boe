import {
  getLatestBoeImapEmails,
  isBoeEmailImapConfigured,
} from "./boe-email-otp-imap";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users";

const DEFAULT_GMAIL_USER_ID = "me";
const DEFAULT_BOE_GMAIL_QUERY = "from:noresponder-subastas@boe.es newer_than:2d";

const RESET_SUBJECT = "Cambio de contrasena en el Portal de Subastas Electronicas";

export type BoeEmailOtpPurpose = "login" | "password_reset" | "any";

interface GmailOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

interface GmailMessageRef {
  id: string;
  threadId: string;
}

interface GmailListMessagesResponse {
  messages?: GmailMessageRef[];
}

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessageBody {
  data?: string;
}

interface GmailMessagePart {
  mimeType?: string;
  headers?: GmailMessageHeader[];
  body?: GmailMessageBody;
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  internalDate: string;
  snippet?: string;
  payload?: GmailMessagePart;
}

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userId: string;
}

export interface BoeEmailOtp {
  code: string;
  messageId: string;
  receivedAt: string;
  subject: string;
  purpose: Exclude<BoeEmailOtpPurpose, "any">;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPurposeQuery(purpose: BoeEmailOtpPurpose): string {
  const base = process.env.BOE_GMAIL_QUERY?.trim() || DEFAULT_BOE_GMAIL_QUERY;
  // Gmail query matching is brittle with accented subjects. We keep the
  // server-side query broad and filter the exact purpose after fetching.
  void purpose;
  return base;
}

function inferPurpose(subject: string, body: string): Exclude<BoeEmailOtpPurpose, "any"> {
  const normalized = normalizeText(`${subject} ${body}`);

  if (normalized.includes(normalizeText(RESET_SUBJECT)) || normalized.includes("cambio de contrasena")) {
    return "password_reset";
  }

  return "login";
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBody(body?: GmailMessageBody): string {
  if (!body?.data) return "";
  return decodeBase64Url(body.data);
}

function collectTextParts(part?: GmailMessagePart): string[] {
  if (!part) return [];

  const collected: string[] = [];

  if (part.mimeType === "text/plain") {
    const decoded = decodeBody(part.body);
    if (decoded) collected.push(decoded);
  }

  if (part.mimeType === "text/html") {
    const decoded = stripHtml(decodeBody(part.body));
    if (decoded) collected.push(decoded);
  }

  for (const child of part.parts || []) {
    collected.push(...collectTextParts(child));
  }

  return collected;
}

function getHeaderValue(part: GmailMessagePart | undefined, name: string): string {
  const header = part?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return header?.value?.trim() || "";
}

export function extractBoeOtpCode(text: string): string | undefined {
  const normalized = normalizeText(text);

  const nearKeyword =
    normalized.match(/codigo de verificacion[^A-Z0-9]{0,80}([A-Z0-9]{8,10})/i) ||
    normalized.match(/siguiente codigo[^A-Z0-9]{0,80}([A-Z0-9]{8,10})/i);

  if (nearKeyword?.[1]) {
    return nearKeyword[1].toUpperCase();
  }

  const candidates = normalized.match(/\b[A-Z0-9]{8,10}\b/g) || [];
  return candidates.find((candidate) => /[A-Z]/.test(candidate))?.toUpperCase();
}

function getGmailConfig(): GmailConfig {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();
  const userId = process.env.GMAIL_USER_ID?.trim() || DEFAULT_GMAIL_USER_ID;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Gmail OAuth config. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN."
    );
  }

  return { clientId, clientSecret, refreshToken, userId };
}

async function fetchGoogleAccessToken(config: GmailConfig): Promise<string> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(`Failed to refresh Gmail access token (${resp.status})`);
  }

  const data = (await resp.json()) as GmailOAuthTokenResponse;
  if (!data.access_token) {
    throw new Error("Gmail token response did not include an access token");
  }

  return data.access_token;
}

async function gmailGetJson<T>(path: string, accessToken: string): Promise<T> {
  const resp = await fetch(path, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(`Gmail API request failed (${resp.status})`);
  }

  return (await resp.json()) as T;
}

export function isBoeEmailOtpConfigured(): boolean {
  return isBoeEmailImapConfigured() || isBoeEmailOauthConfigured();
}

export function isBoeEmailOauthConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID?.trim() &&
      process.env.GMAIL_CLIENT_SECRET?.trim() &&
      process.env.GMAIL_REFRESH_TOKEN?.trim()
  );
}

export async function getLatestBoeEmailOtp(
  purpose: BoeEmailOtpPurpose = "login"
): Promise<BoeEmailOtp | null> {
  if (isBoeEmailImapConfigured()) {
    try {
      const query = buildPurposeQuery(purpose);
      const messages = await getLatestBoeImapEmails(query);

      for (const message of messages) {
        const code = extractBoeOtpCode(`${message.subject}\n${message.bodyText}`);

        if (!code) {
          continue;
        }

        const resolvedPurpose = inferPurpose(message.subject, message.bodyText);
        if (purpose !== "any" && resolvedPurpose !== purpose) {
          continue;
        }

        return {
          code,
          messageId: message.messageId,
          receivedAt: message.receivedAt,
          subject: message.subject,
          purpose: resolvedPurpose,
        };
      }

      return null;
    } catch (error) {
      if (!isBoeEmailOauthConfigured()) {
        throw error;
      }
    }
  }

  const config = getGmailConfig();
  const accessToken = await fetchGoogleAccessToken(config);
  const query = buildPurposeQuery(purpose);

  const listUrl = new URL(
    `${GMAIL_API_BASE_URL}/${encodeURIComponent(config.userId)}/messages`
  );
  listUrl.searchParams.set("maxResults", "20");
  listUrl.searchParams.set("q", query);

  const list = await gmailGetJson<GmailListMessagesResponse>(listUrl.toString(), accessToken);
  const messageRefs = list.messages || [];

  for (const messageRef of messageRefs) {
    const messageUrl = `${GMAIL_API_BASE_URL}/${encodeURIComponent(config.userId)}/messages/${encodeURIComponent(messageRef.id)}?format=full`;
    const message = await gmailGetJson<GmailMessage>(messageUrl, accessToken);
    const subject = getHeaderValue(message.payload, "Subject");
    const bodyText = collectTextParts(message.payload).join("\n").trim() || message.snippet || "";
    const code = extractBoeOtpCode(`${subject}\n${bodyText}`);

    if (!code) {
      continue;
    }

    const resolvedPurpose = inferPurpose(subject, bodyText);
    if (purpose !== "any" && resolvedPurpose !== purpose) {
      continue;
    }

    const receivedAt = new Date(Number(message.internalDate)).toISOString();

    return {
      code,
      messageId: message.id,
      receivedAt,
      subject,
      purpose: resolvedPurpose,
    };
  }

  return null;
}
