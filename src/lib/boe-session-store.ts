import { getRuntimeStateCollection } from "./mongodb";
import type { BoeSession } from "./boe-session";

const BOE_SESSION_DOC_ID = "boe-session";

export interface PersistedBoeSession extends BoeSession {
  source?: string;
  authenticatedAt?: string;
  lastVerifiedAt?: string;
  updatedAt: string;
}

interface PersistedBoeSessionDoc extends PersistedBoeSession {
  _id: string;
}

function sanitizeSession(session: BoeSession): BoeSession {
  return {
    sessId: session.sessId?.trim() || undefined,
    simpleSaml: session.simpleSaml?.trim() || undefined,
  };
}

export async function loadPersistedBoeSession(): Promise<PersistedBoeSession | null> {
  try {
    const col = await getRuntimeStateCollection<PersistedBoeSessionDoc>();
    const doc = await col.findOne({
      _id: BOE_SESSION_DOC_ID,
    });

    if (!doc?.sessId) {
      return null;
    }

    return {
      sessId: doc.sessId,
      simpleSaml: doc.simpleSaml,
      source: doc.source,
      authenticatedAt: doc.authenticatedAt,
      lastVerifiedAt: doc.lastVerifiedAt,
      updatedAt: doc.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function savePersistedBoeSession(
  session: BoeSession,
  meta: {
    source?: string;
    authenticatedAt?: string;
    lastVerifiedAt?: string;
  } = {}
): Promise<void> {
  const normalized = sanitizeSession(session);
  if (!normalized.sessId) return;

  try {
    const col = await getRuntimeStateCollection<PersistedBoeSessionDoc>();
    await col.updateOne(
      { _id: BOE_SESSION_DOC_ID },
      {
        $set: {
          ...normalized,
          updatedAt: new Date().toISOString(),
          ...(meta.source ? { source: meta.source } : {}),
          ...(meta.authenticatedAt ? { authenticatedAt: meta.authenticatedAt } : {}),
          ...(meta.lastVerifiedAt ? { lastVerifiedAt: meta.lastVerifiedAt } : {}),
        },
      },
      { upsert: true }
    );
  } catch {
    // Mongo is optional for runtime persistence.
  }
}

export async function clearPersistedBoeSession(): Promise<void> {
  try {
    const col = await getRuntimeStateCollection<PersistedBoeSessionDoc>();
    await col.deleteOne({ _id: BOE_SESSION_DOC_ID });
  } catch {
    // ignore
  }
}
