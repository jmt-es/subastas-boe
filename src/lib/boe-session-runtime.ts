import { isBoePasswordLoginConfigured, loginWithBoePassword } from "./boe-login";
import {
  isBoeSessionActive,
  resolveBoeSession,
  type BoeSession,
  type BoeSessionInput,
} from "./boe-session";
import {
  loadPersistedBoeSession,
  savePersistedBoeSession,
  type PersistedBoeSession,
} from "./boe-session-store";

let cachedSession: BoeSession | undefined;
let pendingSessionPromise: Promise<BoeSession> | undefined;

function assignProcessSession(session: BoeSession) {
  if (session.sessId) process.env.BOE_SESSID = session.sessId;
  if (session.simpleSaml) process.env.BOE_SIMPLESAML = session.simpleSaml;
}

export function getCachedBoeSession(): BoeSession | undefined {
  return cachedSession;
}

export async function getPersistedUsableBoeSession(): Promise<PersistedBoeSession | null> {
  const stored = await loadPersistedBoeSession();
  if (!stored?.sessId) return null;

  const active = await isBoeSessionActive(stored);
  if (!active) return null;

  cachedSession = {
    sessId: stored.sessId,
    simpleSaml: stored.simpleSaml,
  };
  assignProcessSession(cachedSession);
  await savePersistedBoeSession(cachedSession, {
    source: stored.source || "persisted",
    authenticatedAt: stored.authenticatedAt,
    lastVerifiedAt: new Date().toISOString(),
  });

  return stored;
}

export async function getUsableBoeSession(
  input: BoeSessionInput = {},
  options: { forceFresh?: boolean } = {}
): Promise<BoeSession> {
  const session = resolveBoeSession(input);

  if (!options.forceFresh && session.sessId) {
    const active = await isBoeSessionActive(session);
    if (active) {
      cachedSession = session;
      assignProcessSession(session);
      await savePersistedBoeSession(session, {
        source: "request",
        lastVerifiedAt: new Date().toISOString(),
      });
      return session;
    }
  }

  if (!options.forceFresh && cachedSession?.sessId) {
    const active = await isBoeSessionActive(cachedSession);
    if (active) {
      assignProcessSession(cachedSession);
      await savePersistedBoeSession(cachedSession, {
        source: "memory_cache",
        lastVerifiedAt: new Date().toISOString(),
      });
      return cachedSession;
    }
  }

  if (!options.forceFresh) {
    const stored = await getPersistedUsableBoeSession();
    if (stored?.sessId) {
      return {
        sessId: stored.sessId,
        simpleSaml: stored.simpleSaml,
      };
    }
  }

  if (!isBoePasswordLoginConfigured()) {
    return session;
  }

  if (!options.forceFresh && pendingSessionPromise) {
    return pendingSessionPromise;
  }

  pendingSessionPromise = loginWithBoePassword()
    .then((freshSession) => {
      cachedSession = {
        sessId: freshSession.sessId,
        simpleSaml: freshSession.simpleSaml,
      };
      assignProcessSession(cachedSession);
      void savePersistedBoeSession(cachedSession, {
        source: "auto_login",
        authenticatedAt: freshSession.authenticatedAt,
        lastVerifiedAt: freshSession.authenticatedAt,
      });
      return cachedSession;
    })
    .finally(() => {
      pendingSessionPromise = undefined;
    });

  return pendingSessionPromise;
}
