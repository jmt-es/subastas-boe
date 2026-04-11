export interface BoeSessionInput {
  sessionId?: string;
  sessId?: string;
  simpleSaml?: string;
}

export interface BoeSession {
  sessId?: string;
  simpleSaml?: string;
}

const BOE_HOST = "subastas.boe.es";

export function resolveBoeSession(input: BoeSessionInput = {}): BoeSession {
  const sessId =
    input.sessId?.trim() ||
    input.sessionId?.trim() ||
    process.env.BOE_SESSID?.trim() ||
    undefined;
  const simpleSaml =
    input.simpleSaml?.trim() ||
    process.env.BOE_SIMPLESAML?.trim() ||
    undefined;

  return { sessId, simpleSaml };
}

export function buildBoeCookieHeader(input: BoeSessionInput = {}): string | undefined {
  const { sessId, simpleSaml } = resolveBoeSession(input);
  const cookies: string[] = [];

  if (sessId) cookies.push(`SESSID=${sessId}`);
  if (simpleSaml) cookies.push(`SimpleSAML=${simpleSaml}`);

  return cookies.length > 0 ? cookies.join("; ") : undefined;
}

export function withBoeRegUrl(url: string, sessId?: string): string {
  if (!sessId || !url.includes(BOE_HOST) || url.includes(`${BOE_HOST}/reg/`)) {
    return url;
  }

  return url.replace(`${BOE_HOST}/`, `${BOE_HOST}/reg/`);
}

export function hasBoeSession(input: BoeSessionInput = {}): boolean {
  return Boolean(resolveBoeSession(input).sessId);
}

export async function isBoeSessionActive(input: BoeSessionInput = {}): Promise<boolean> {
  const session = resolveBoeSession(input);
  if (!session.sessId) {
    return false;
  }

  try {
    const cookieHeader = buildBoeCookieHeader(session);
    const resp = await fetch("https://subastas.boe.es/reg/subastas_ava.php", {
      headers: {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      redirect: "manual",
      cache: "no-store",
    });

    if (resp.status !== 200) {
      return false;
    }

    const html = await resp.text();
    return html.includes('name="accion"') || html.includes("Buscar");
  } catch {
    return false;
  }
}
