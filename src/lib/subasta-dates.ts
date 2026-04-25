const DATE_TIME_RE =
  /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/;

export function parseBoeDateToIso(value?: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  const match = trimmed.match(DATE_TIME_RE);
  if (!match) return undefined;

  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
}

export function getActiveSubastasFilter(now = new Date()): Record<string, unknown> {
  const graceWindowMs = 12 * 60 * 60 * 1000;
  const recentFallbackMs = 72 * 60 * 60 * 1000;

  return {
    $or: [
      {
        fechaConclusionAt: {
          $gte: new Date(now.getTime() - graceWindowMs).toISOString(),
        },
      },
      {
        fechaConclusionAt: { $exists: false },
        scrapedAt: {
          $gte: new Date(now.getTime() - recentFallbackMs).toISOString(),
        },
      },
    ],
  };
}

export function getInactiveSubastasFilter(now = new Date()): Record<string, unknown> {
  return {
    $nor: [getActiveSubastasFilter(now)],
  };
}

function parseDateTime(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isSubastaActive(
  input: { fechaConclusionAt?: string; fechaConclusion?: string; scrapedAt?: string },
  now = new Date()
): boolean {
  const graceWindowMs = 12 * 60 * 60 * 1000;
  const recentFallbackMs = 72 * 60 * 60 * 1000;
  const activeCutoff = now.getTime() - graceWindowMs;
  const recentCutoff = now.getTime() - recentFallbackMs;

  const conclusionTime =
    parseDateTime(input.fechaConclusionAt) ?? parseDateTime(parseBoeDateToIso(input.fechaConclusion));
  if (conclusionTime !== null) {
    return conclusionTime >= activeCutoff;
  }

  const scrapedTime = parseDateTime(input.scrapedAt);
  if (scrapedTime !== null) {
    return scrapedTime >= recentCutoff;
  }

  return false;
}
