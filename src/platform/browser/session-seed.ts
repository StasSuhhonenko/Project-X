/**
 * Browser entropy for a new session's world random stream.
 *
 * Legacy Flash games seeded `random()` from the system clock, so every new
 * game rolled different entry encounters. The simulation stays pure: it only
 * receives this uint32 through `createAppStore(..., { sessionSeed })` at the
 * composition root, and saves carry the resulting stream state.
 */
export function createSessionSeed(): number {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0]!;
}
