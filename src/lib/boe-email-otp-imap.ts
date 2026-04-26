import tls from "node:tls";

const DEFAULT_IMAP_HOST = "imap.gmail.com";
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_IMAP_MAILBOX = "INBOX";
const DEFAULT_SEARCH_QUERY = "from:noresponder-subastas@boe.es newer_than:2d";
const COMMAND_TIMEOUT_MS = 20_000;

interface GmailImapConfig {
  host: string;
  port: number;
  mailbox: string;
  user: string;
  appPassword: string;
}

export interface BoeImapEmail {
  messageId: string;
  receivedAt: string;
  subject: string;
  bodyText: string;
}

interface ParsedEmail {
  headers: Record<string, string>;
  body: string;
}

type PendingRead = {
  matcher: RegExp;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

function quoteImap(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_IMAP_PORT;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IMAP_PORT;
}

function getGmailImapConfig(): GmailImapConfig {
  const user = process.env.GMAIL_IMAP_USER?.trim() || process.env.GMAIL_USER_ID?.trim();
  const appPassword = process.env.GMAIL_IMAP_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !appPassword) {
    throw new Error(
      "Missing Gmail IMAP config. Set GMAIL_IMAP_USER and GMAIL_IMAP_APP_PASSWORD."
    );
  }

  return {
    host: process.env.GMAIL_IMAP_HOST?.trim() || DEFAULT_IMAP_HOST,
    port: parsePort(process.env.GMAIL_IMAP_PORT),
    mailbox: process.env.GMAIL_IMAP_MAILBOX?.trim() || DEFAULT_IMAP_MAILBOX,
    user,
    appPassword,
  };
}

export function isBoeEmailImapConfigured(): boolean {
  return Boolean(
    (process.env.GMAIL_IMAP_USER?.trim() || process.env.GMAIL_USER_ID?.trim()) &&
      process.env.GMAIL_IMAP_APP_PASSWORD?.trim()
  );
}

class ImapClient {
  private buffer = "";
  private pending?: PendingRead;
  private socket?: tls.TLSSocket;
  private tagCounter = 0;

  constructor(private readonly config: GmailImapConfig) {}

  async connect(): Promise<void> {
    this.socket = tls.connect({
      host: this.config.host,
      port: this.config.port,
      servername: this.config.host,
    });

    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
      this.flushPending();
    });

    this.socket.on("error", (error) => {
      this.pending?.reject(error);
    });

    await this.readUntil(/^\* OK/m);
  }

  async login(): Promise<void> {
    await this.command(
      `LOGIN ${quoteImap(this.config.user)} ${quoteImap(this.config.appPassword)}`
    );
  }

  async selectMailbox(): Promise<void> {
    await this.command(`SELECT ${quoteImap(this.config.mailbox)}`);
  }

  async search(query: string): Promise<number[]> {
    const response = await this.command(`UID SEARCH X-GM-RAW ${quoteImap(query)}`);
    const match = response.match(/^\* SEARCH\s*(.*)$/m);
    if (!match?.[1]?.trim()) return [];

    return match[1]
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
  }

  async fetchRawEmail(uid: number): Promise<string> {
    const response = await this.command(`UID FETCH ${uid} (BODY.PEEK[])`);
    return extractFirstLiteral(response) || response;
  }

  async logout(): Promise<void> {
    if (!this.socket || this.socket.destroyed) return;
    try {
      await this.command("LOGOUT");
    } catch {
      // best effort
    } finally {
      this.socket.end();
      this.socket.destroy();
    }
  }

  private async command(command: string): Promise<string> {
    const tag = `A${String(++this.tagCounter).padStart(4, "0")}`;
    const matcher = new RegExp(`(?:^|\\r?\\n)${tag} (?:OK|NO|BAD)`, "m");

    if (!this.socket || this.socket.destroyed) {
      throw new Error("IMAP socket is not connected");
    }

    const read = this.readUntil(matcher);
    this.socket.write(`${tag} ${command}\r\n`);
    const response = await read;

    if (new RegExp(`(?:^|\\r?\\n)${tag} (?:NO|BAD)`, "m").test(response)) {
      throw new Error(`Gmail IMAP command failed: ${redactImapResponse(response, tag)}`);
    }

    return response;
  }

  private readUntil(matcher: RegExp): Promise<string> {
    this.flushPending();

    const existing = this.matchBuffered(matcher);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending?.matcher === matcher) {
          this.pending = undefined;
        }
        reject(new Error("Timed out waiting for Gmail IMAP response"));
      }, COMMAND_TIMEOUT_MS);

      this.pending = { matcher, resolve, reject, timeout };
      this.flushPending();
    });
  }

  private flushPending() {
    if (!this.pending) return;

    const matched = this.matchBuffered(this.pending.matcher);
    if (!matched) return;

    const pending = this.pending;
    this.pending = undefined;
    clearTimeout(pending.timeout);
    pending.resolve(matched);
  }

  private matchBuffered(matcher: RegExp): string | null {
    const match = this.buffer.match(matcher);
    if (!match || match.index === undefined) return null;

    const end = match.index + match[0].length;
    const response = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end);
    return response;
  }
}

function redactImapResponse(response: string, tag: string): string {
  return response
    .split(/\r?\n/)
    .filter((line) => line.startsWith(tag))
    .join(" ")
    .slice(0, 300);
}

function extractFirstLiteral(response: string): string | null {
  const marker = response.match(/\{(\d+)\}\r?\n/);
  if (!marker?.[1] || marker.index === undefined) return null;

  const start = marker.index + marker[0].length;
  const byteLength = Number.parseInt(marker[1], 10);
  if (!Number.isFinite(byteLength)) return null;

  return response.slice(start, start + byteLength);
}

function unfoldHeaders(headerText: string): string[] {
  const lines = headerText.split(/\r?\n/);
  const unfolded: string[] = [];

  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else if (line.trim()) {
      unfolded.push(line.trim());
    }
  }

  return unfolded;
}

function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of unfoldHeaders(headerText)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }

  return headers;
}

function parseRawEmail(raw: string): ParsedEmail {
  const split = raw.search(/\r?\n\r?\n/);
  if (split === -1) {
    return { headers: {}, body: raw };
  }

  const headerText = raw.slice(0, split);
  const body = raw.slice(raw.indexOf("\n", split) + 1);

  return {
    headers: parseHeaders(headerText),
    body,
  };
}

function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g,
    (_, charset: string, encoding: string, encoded: string) => {
      try {
        const buffer =
          encoding.toUpperCase() === "B"
            ? Buffer.from(encoded, "base64")
            : decodeQuotedPrintableBuffer(encoded.replace(/_/g, " "));
        return buffer.toString(charset.toLowerCase().includes("iso-8859-1") ? "latin1" : "utf8");
      } catch {
        return encoded;
      }
    }
  );
}

function decodeQuotedPrintableBuffer(value: string): Buffer {
  const cleaned = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i += 1) {
    if (
      cleaned[i] === "=" &&
      i + 2 < cleaned.length &&
      /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))
    ) {
      bytes.push(Number.parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(cleaned.charCodeAt(i));
    }
  }

  return Buffer.from(bytes);
}

function decodeTransferBody(body: string, encoding: string | undefined): string {
  const normalized = encoding?.toLowerCase();

  if (normalized === "base64") {
    return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  }

  if (normalized === "quoted-printable") {
    return decodeQuotedPrintableBuffer(body).toString("utf8");
  }

  return body;
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

function extractBoundary(contentType: string | undefined): string | undefined {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match?.[1] || match?.[2];
}

function extractTextFromMime(raw: string): string {
  const parsed = parseRawEmail(raw);
  const contentType = parsed.headers["content-type"]?.toLowerCase();
  const boundary = extractBoundary(parsed.headers["content-type"]);

  if (contentType?.includes("multipart/") && boundary) {
    return parsed.body
      .split(`--${boundary}`)
      .filter((part) => part.trim() && !part.trim().startsWith("--"))
      .map((part) => extractTextFromMime(part.replace(/^\r?\n/, "")))
      .filter(Boolean)
      .join("\n");
  }

  const decoded = decodeTransferBody(
    parsed.body,
    parsed.headers["content-transfer-encoding"]
  );

  if (contentType?.includes("text/html")) {
    return stripHtml(decoded);
  }

  return decoded.trim();
}

export function parseBoeImapEmail(raw: string, uid: number): BoeImapEmail {
  const parsed = parseRawEmail(raw);
  const subject = decodeMimeWords(parsed.headers.subject || "");
  const date = parsed.headers.date ? Date.parse(parsed.headers.date) : NaN;

  return {
    messageId: parsed.headers["message-id"] || `imap:${uid}`,
    receivedAt: Number.isFinite(date) ? new Date(date).toISOString() : new Date().toISOString(),
    subject,
    bodyText: extractTextFromMime(raw),
  };
}

export async function getLatestBoeImapEmails(
  query = process.env.BOE_GMAIL_QUERY?.trim() || DEFAULT_SEARCH_QUERY,
  maxResults = 20
): Promise<BoeImapEmail[]> {
  const config = getGmailImapConfig();
  const client = new ImapClient(config);

  try {
    await client.connect();
    await client.login();
    await client.selectMailbox();

    const uids = await client.search(query);
    const latestUids = uids.slice(-maxResults).reverse();
    const messages: BoeImapEmail[] = [];

    for (const uid of latestUids) {
      const raw = await client.fetchRawEmail(uid);
      messages.push(parseBoeImapEmail(raw, uid));
    }

    return messages;
  } finally {
    await client.logout();
  }
}
