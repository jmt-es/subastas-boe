import assert from "node:assert/strict";
import test from "node:test";

import { parseBoeImapEmail } from "./boe-email-otp-imap";
import { extractBoeOtpCode } from "./boe-email-otp";

test("parseBoeImapEmail decodes quoted printable BOE messages", () => {
  const raw = [
    "Subject: =?UTF-8?Q?C=C3=B3digo_de_verificaci=C3=B3n?=",
    "Date: Sat, 25 Apr 2026 09:30:00 +0000",
    "Message-ID: <otp-1@example.test>",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Use el siguiente c=C3=B3digo de verificaci=C3=B3n: AB12CD34",
  ].join("\r\n");

  const email = parseBoeImapEmail(raw, 42);

  assert.equal(email.messageId, "<otp-1@example.test>");
  assert.equal(email.receivedAt, "2026-04-25T09:30:00.000Z");
  assert.equal(email.subject, "Código de verificación");
  assert.equal(extractBoeOtpCode(email.bodyText), "AB12CD34");
});

test("parseBoeImapEmail extracts text from multipart html messages", () => {
  const raw = [
    "Subject: Portal de Subastas",
    "Date: Sat, 25 Apr 2026 09:31:00 +0000",
    "Content-Type: multipart/alternative; boundary=abc",
    "",
    "--abc",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("<html><body>Su codigo de verificacion es ZXCVB123</body></html>").toString(
      "base64"
    ),
    "--abc--",
  ].join("\r\n");

  const email = parseBoeImapEmail(raw, 43);

  assert.equal(extractBoeOtpCode(email.bodyText), "ZXCVB123");
});
