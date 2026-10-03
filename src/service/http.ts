/**
 * Gemeinsame HTTP-Helfer fuer alle Anbieter.
 *
 * Eigenes Modul ohne Abhaengigkeiten: `adapters.ts` und `gateways.ts`
 * importieren sich gegenseitig, und wer die Header von dort bezieht, laeuft
 * sonst in einen Zirkelschluss.
 */

/**
 * Eigener User-Agent bei jedem Aufruf nach draussen.
 *
 * Ohne ihn antworten manche Anbieter mit 404 – Featherless etwa akzeptiert
 * nur Browser-Anfragen. Ein leerer Node-User-Agent ist kein Standard, den
 * man einem API-Dienst zumuten sollte.
 */
export const USER_AGENT = 'OpenChamber-Router/0.1.0 (+https://openchamber.dev)'

/** Basis-Header fuer jeden ausgehenden Aufruf. */
export const baseHeaders = (): Record<string, string> => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
})

/** Bearer-Token. */
export const bearer = (token: string): Record<string, string> => ({
  ...baseHeaders(),
  Authorization: `Bearer ${token}`,
})
