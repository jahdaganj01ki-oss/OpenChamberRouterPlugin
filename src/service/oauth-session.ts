/**
 * Was eine Antwort des Anbieters mit der Anmeldung macht.
 *
 * Ausgelagert aus der Route, weil genau dieser Schritt nie beobachtet
 * worden ist: der Nutzer hat bestaetigt, GitHub hat ein Token geschickt – und
 * danach ist nichts mehr passiert, ohne dass jemand wusste warum. Alles
 * davor war messbar, dieser Teil nicht.
 *
 * Darum liegen die Abhaengigkeiten hier als Parameter vor. Der Test kann eine
 * erfundene Anmeldung und einen erfundenen Anbieter benutzen; das Verhalten
 * ist dasselbe wie im Betrieb.
 */

import type { OAuthSession, TokenResponse } from './oauth.ts'
import { nextInterval, type PollResult } from './oauth.ts'

/** Was beim Anlegen des Kontos schiefgehen kann. */
export interface AnlegenErgebnis {
  id?: string
  label?: string
  error?: string
  /** Nebel, der nicht untergehen darf – etwa „Tarif unbekannt". */
  note?: string
}

export type Anlegen = (
  session: OAuthSession,
  token: TokenResponse,
) => Promise<AnlegenErgebnis>

/**
 * Eine Antwort des Anbieters verarbeiten.
 *
 * @param session  wird in-place fortgeschrieben
 * @param antwort  genau eine, so wie `pollDeviceFlow` sie geliefert hat
 * @param anlegen  legt das Konto an; liefert `error`, wenn es scheitert
 */
export const verarbeiteAntwort = async (
  session: OAuthSession,
  antwort: PollResult,
  anlegen: Anlegen,
): Promise<void> => {
  if (antwort.kind === 'slow-down') {
    // Der Anbieter verlangt mehr Abstand. Wir gehorchen ab sofort, und sagen
    // es – statt weiter ungeduldig zu fragen und den Vorgang zu gefaehrden.
    session.intervalMs = nextInterval(
      session.intervalMs ?? 5000,
      antwort.intervalSeconds,
    )
    session.lastEvent =
      `Zu oft abgefragt – Abstand jetzt ` +
      `${Math.round((session.intervalMs ?? 5000) / 1000)} s.`
    return
  }

  if (antwort.kind === 'pending') {
    session.lastEvent = `Noch offen (${session.polls ?? 0} Abfragen).`
    return
  }

  if (antwort.kind === 'denied') {
    // Ablehnung ist kein Fehler des Dienstes, sondern eine Entscheidung des
    // Nutzers. Deshalb ein eigener Zustand und keine Fehlermeldung.
    session.state = 'denied'
    session.error = antwort.reason
    session.lastEvent = antwort.reason
    return
  }

  // Hier ist das Token. Jetzt erst das Konto anlegen.
  const ergebnis = await anlegen(session, antwort.token)

  if (ergebnis.error || !ergebnis.id) {
    session.state = 'error'
    session.error = ergebnis.error ?? 'Konto konnte nicht angelegt werden.'
    session.lastEvent = session.error
    return
  }

  session.state = 'done'
  session.connectionId = ergebnis.id
  session.plan = ergebnis.label
  session.lastEvent = session.plan
    ? `Angemeldet. Tarif: ${session.plan}.`
    : 'Angemeldet.'
  // Ein Hinweis beim Anlegen darf nicht verschwinden, nur weil die Anmeldung
  // geklappt hat. Sonst weiss niemand, dass der Tarif ungeklaert blieb.
  if (ergebnis.note) session.lastEvent += ` ${ergebnis.note}`
  session.deviceCode = undefined
}
