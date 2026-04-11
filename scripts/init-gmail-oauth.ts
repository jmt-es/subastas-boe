import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import { homedir } from "os";
import { resolve } from "path";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const DEFAULT_OUTPUT_PATH = "/tmp/subasta-gmail-oauth.json";
const DEFAULT_KEYS_PATH = resolve(homedir(), ".gmail-mcp", "gcp-oauth.keys.json");

interface GoogleInstalledClient {
  installed?: {
    client_id?: string;
    client_secret?: string;
  };
}

function base64Url(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Base64Url(value: string): string {
  return base64Url(createHash("sha256").update(value).digest());
}

function loadDotEnv(path: string) {
  if (!existsSync(path)) return;

  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function resolveOauthClient() {
  loadDotEnv(resolve(process.cwd(), ".env.local"));

  const envClientId = process.env.GMAIL_CLIENT_ID?.trim();
  const envClientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();

  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }

  const keysPath = process.env.GMAIL_OAUTH_KEYS_PATH?.trim() || DEFAULT_KEYS_PATH;
  if (!existsSync(keysPath)) {
    throw new Error(
      `Missing Gmail OAuth client. Set GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET or provide ${keysPath}.`
    );
  }

  const parsed = JSON.parse(readFileSync(keysPath, "utf8")) as GoogleInstalledClient;
  const clientId = parsed.installed?.client_id?.trim();
  const clientSecret = parsed.installed?.client_secret?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(`Invalid Gmail OAuth client file: ${keysPath}`);
  }

  return { clientId, clientSecret };
}

async function main() {
  const { clientId, clientSecret } = resolveOauthClient();
  const loginHint = process.argv[2]?.trim() || "javmartorc@gmail.com";
  const scope = process.argv[3]?.trim() || DEFAULT_SCOPE;
  const outputPath = process.argv[4]?.trim() || DEFAULT_OUTPUT_PATH;

  const state = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(48));
  const codeChallenge = sha256Base64Url(codeVerifier);

  const authResult = await new Promise<{
    code: string;
    redirectUri: string;
  }>((resolvePromise, rejectPromise) => {
    let settled = false;

    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost");
      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>OAuth cancelado</h1><p>Vuelve al terminal para ver el detalle.</p>");
        if (!settled) {
          settled = true;
          rejectPromise(new Error(`Google OAuth error: ${error}`));
        }
        server.close();
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Solicitud inválida</h1><p>El estado no coincide.</p>");
        if (!settled) {
          settled = true;
          rejectPromise(new Error("OAuth callback missing code or state did not match"));
        }
        server.close();
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<h1>Autorización completada</h1><p>Puedes cerrar esta pestaña y volver a Codex.</p>"
      );

      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const redirectUri = `http://localhost:${port}`;

      if (!settled) {
        settled = true;
        resolvePromise({ code, redirectUri });
      }

      server.close();
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const redirectUri = `http://localhost:${port}`;
      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scope);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("login_hint", loginHint);

      console.log(`Open this URL in a browser:\n${authUrl.toString()}`);
    });
  });

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: authResult.code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: authResult.redirectUri,
    }),
  });

  const tokenJson = await tokenResp.json();
  if (!tokenResp.ok) {
    throw new Error(
      `Token exchange failed (${tokenResp.status}): ${tokenJson.error || "unknown_error"}`
    );
  }

  writeFileSync(outputPath, `${JSON.stringify(tokenJson, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log(`Saved Gmail OAuth token payload to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
