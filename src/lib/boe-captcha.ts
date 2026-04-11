import { GoogleGenAI } from "@google/genai";

const CAPTCHA_MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada para resolver el CAPTCHA del BOE.");
  }

  return new GoogleGenAI({ apiKey });
}

export function isBoeCaptchaSolverConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function sanitizeCaptchaCandidate(raw: string): string | null {
  const candidate = raw.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!candidate) return null;
  if (!/^[A-Za-z0-9]{4,8}$/.test(candidate)) return null;
  return candidate;
}

export async function guessBoeCaptchaCandidates(
  imageBase64: string,
  maxCandidates = 4
): Promise<string[]> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: CAPTCHA_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: imageBase64,
            },
          },
          {
            text:
              "Lee este CAPTCHA del BOE. Devuelve hasta 6 códigos candidatos plausibles, uno por línea, sin numeración ni explicación. Conserva mayúsculas y minúsculas y usa solo caracteres alfanuméricos.",
          },
        ],
      },
    ],
  });

  const text = (response.text ?? "").trim();
  const candidates = text
    .split(/\r?\n/)
    .map(sanitizeCaptchaCandidate)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates)).slice(0, maxCandidates);
}

