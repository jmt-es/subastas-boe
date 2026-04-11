import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import {
  getLatestBoeEmailOtp,
  isBoeEmailOtpConfigured,
  type BoeEmailOtpPurpose,
} from "../src/lib/boe-email-otp";

const VALID_PURPOSES = new Set<BoeEmailOtpPurpose>(["login", "password_reset", "any"]);

function parsePurpose(raw: string | undefined): BoeEmailOtpPurpose {
  if (!raw) return "login";
  if (VALID_PURPOSES.has(raw as BoeEmailOtpPurpose)) {
    return raw as BoeEmailOtpPurpose;
  }
  throw new Error(`Invalid purpose "${raw}". Use: login | password_reset | any`);
}

async function main() {
  const purpose = parsePurpose(process.argv[2]);

  if (!isBoeEmailOtpConfigured()) {
    throw new Error(
      "Missing Gmail OAuth config. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN."
    );
  }

  const otp = await getLatestBoeEmailOtp(purpose);

  if (!otp) {
    console.log(`No BOE OTP email found for purpose="${purpose}".`);
    return;
  }

  console.log("Latest BOE OTP");
  console.log(`Purpose : ${otp.purpose}`);
  console.log(`Code    : ${otp.code}`);
  console.log(`Received: ${otp.receivedAt}`);
  console.log(`Subject : ${otp.subject}`);
  console.log(`Message : ${otp.messageId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
