/**
 * Zahlen lesbar machen, die OpenCode anzeigt.
 *
 * Fenster und Ausgabelaengen sind die Zahlen, an denen man sich beim
 * Planen von Sitzungen orientiert. Roh ausgeschrieben sind sie unbrauchbar:
 * 1048576 Tokens sehen aus wie eine Fehlermeldung, nicht wie „1 Mio.".
 */

/** Nachkommanullen abschneiden: 1.0 -> 1, 1.05 -> 1.05, 4.10 -> 4.1 */
const ohneNullen = (wert: number, stellen: number): string =>
  Number(wert.toFixed(stellen)).toString()

/**
 * 1048576 -> „1M", 262144 -> „262k", 65536 -> „66k", 4096 -> „4.1k"
 *
 * Bei Tausendern gilt: auf ganze Tausend runden, wenn der Unterschied unter
 * einem Prozent liegt. 262144 ist praktisch „262k" – da waere „262.1k"
 * nur Rauschen. 4096 dagegen ist nicht rund, also steht dort „4.1k".
 *
 * Bei Millionen sind zwei Nachkommastellen noetig. Mit einer einzigen fallen
 * 1000000 und 1048576 beide auf „1M" – und damit genau der Fehler wieder auf,
 * den es zu beheben galt: mehrere Modelle mit derselben Zahl. Wer 262144 von
 * 1048576 unterscheiden muss, muss auch 1000000 von 1310720 unterscheiden
 * koennen.
 */
export const formatFenster = (tokens: number): string => {
  if (!Number.isFinite(tokens) || tokens <= 0) return '—'

  if (tokens >= 1_000_000) return `${ohneNullen(tokens / 1_000_000, 2)}M`

  if (tokens >= 1000) {
    const k = tokens / 1000
    const ganz = Math.round(k)
    if (ganz > 0 && Math.abs(k - ganz) / ganz < 0.01) return `${ganz}k`
    return `${ohneNullen(k, 1)}k`
  }

  return `${Math.round(tokens)}`
}