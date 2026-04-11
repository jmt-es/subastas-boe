const SMALL_WORDS = new Set(["a", "al", "de", "del", "el", "en", "la", "las", "los", "y"]);

export function normalizeText(value?: string): string {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function capitalizeCompound(word: string): string {
  return word
    .split(/(['-])/)
    .map((piece, index) => {
      if (index % 2 === 1 || !piece) return piece;
      return `${piece.charAt(0).toLocaleUpperCase("es-ES")}${piece.slice(1)}`;
    })
    .join("");
}

export function smartTitleCase(value?: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (/[a-záéíóúüñ]/.test(normalized)) return normalized;

  return normalized
    .toLocaleLowerCase("es-ES")
    .split(" ")
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return capitalizeCompound(word);
    })
    .join(" ");
}

export function smartSentenceCase(value?: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (/[a-záéíóúüñ]/.test(normalized)) return normalized;

  const lowered = normalized.toLocaleLowerCase("es-ES");
  return `${lowered.charAt(0).toLocaleUpperCase("es-ES")}${lowered.slice(1)}`;
}

export function provinceLabel(value?: string): string {
  if (!value) return "";
  return smartTitleCase(value.split("/")[0]?.trim() || value);
}

export function parseAmountNumber(value?: string): number | null {
  const normalized = normalizeText(value);
  if (!normalized || normalized.toLocaleLowerCase("es-ES").includes("lote")) return null;

  const cleaned = normalized.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const negative = cleaned.startsWith("-");
  let digits = cleaned.replace(/-/g, "");

  const hasComma = digits.includes(",");
  const hasDot = digits.includes(".");

  if (hasComma && hasDot) {
    digits = digits.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    const parts = digits.split(",");
    const decimalDigits = parts.at(-1)?.length ?? 0;
    digits = decimalDigits === 3 ? digits.replace(/,/g, "") : digits.replace(/,/g, ".");
  } else if (hasDot) {
    const parts = digits.split(".");
    const decimalDigits = parts.at(-1)?.length ?? 0;
    if (parts.length > 2 || decimalDigits === 3) digits = digits.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(`${negative ? "-" : ""}${digits}`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(value?: string, options?: { allowZero?: boolean }): string {
  if (!value) return "—";
  if (value.toLocaleLowerCase("es-ES").includes("lote")) return "Ver lotes";

  const amount = parseAmountNumber(value);
  if (amount === null) return value;
  if (!options?.allowZero && amount === 0) return "—";

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
