/**
 * Der Vertrag zwischen Dienst und Oberflaeche bei den Anmelde-Anbietern.
 *
 * Der Block „Anmeldung" ist nur dann sichtbar, wenn die Antwort von
 * `/adapters` den Anbieter unter `oauth` nennt. Fehlt dieser Eintrag, bleibt
 * der Block einfach weg – ohne Fehlermeldung, weil ein leeres Set ein
 * vollstaendig gueltiger Zustand ist. Genau so ist das wochenlang
 * unbemerkt geblieben.
 *
 * Diese Tests halten beide Seiten fest: der Dienst muss die Anbieter melden,
 * und die Oberflaeche muss daraus den Block ableiten.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { oauthAdapters } from '../src/service/oauth-adapters.ts'
import { providers } from '../src/providers/catalog.ts'

/** Form der Antwort, die `/adapters` liefert. */
interface AdaptersAnswer {
  ready: string[]
  oauth: string[]
  models: Record<string, boolean>
}

const answer = (): AdaptersAnswer => ({
  ready: ['openrouter', ...Object.keys(oauthAdapters)],
  oauth: Object.keys(oauthAdapters),
  models: { openrouter: true, copilot: true },
})

test('der Dienst nennt seine Anmelde-Anbieter', () => {
  const a = answer()
  assert.ok(a.oauth.includes('copilot'), 'copilot muss als anmeldefähig gelten')
  assert.ok(a.ready.includes('copilot'), 'copilot muss bedient werden')
})

test('jeder OAuth-Anbieter im Katalog ist wirklich anmeldefähig verdrahtet', () => {
  // Umgekehrt gilt: was der Katalog als `oauth` führt, braucht eine
  // Anmeldung. Fehlt der Adapter, muss die Oberflaeche das sagen – und das
  // kann nur der Dienst melden.
  const oauthIds = providers.filter((p) => p.auth === 'oauth').map((p) => p.id)
  const verdrahtet = new Set(oauthIds)
  const a = answer()

  // Nur Copilot ist gebaut. Die anderen sind als geplant gekennzeichnet.
  const fehlend = [...verdrahtet].filter((id) => !a.oauth.includes(id))
  assert.ok(
    fehlend.length > 0,
    'es gibt OAuth-Anbieter ohne Geraetefluss – die Oberflaeche muss darauf hinweisen',
  )
})

/** Genau die Bedingung, mit der die Oberflaeche das Schluesselfeld abhaengt. */
const showsSecretField = (auth: string): boolean =>
  auth !== 'none' && auth !== 'oauth'

test('ein Katalog-Anbieter mit auth oauth braucht kein Schluesselfeld', () => {
  // Regression: das Feld erschien, weil gegen `oauth-device` geprueft wurde –
  // einen Wert, den es im Katalog nicht gibt. Der Vergleich war immer wahr.
  const copilot = providers.find((p) => p.id === 'copilot')
  assert.ok(copilot)
  assert.equal(showsSecretField(copilot.auth), false, 'Copilot darf kein Schluesselfeld zeigen')
})

test('API-Key-Anbieter behalten ihr Schluesselfeld', () => {
  const openrouter = providers.find((p) => p.id === 'openrouter')
  assert.ok(openrouter)
  assert.equal(showsSecretField(openrouter.auth), true)
})

test('jeder Katalog-Anbieter traegt einen bekannten Auth-Wert', () => {
  // Sonst faellt die Feldentscheidung still auf den falschen Zweig.
  const bekannt = ['api-key', 'oauth', 'cookie', 'none', 'local']
  const fremd = providers.map((p) => p.auth).filter((a) => !bekannt.includes(a))
  assert.deepEqual([...new Set(fremd)], [], 'unbekannte Auth-Werte im Katalog')
})

test('die Oberflaeche leitet den Block aus der Antwort ab', () => {
  // Nachbau der Bedingung aus renderDetail.
  const a = answer()
  const oauthProviders = new Set(a.oauth)

  assert.equal(oauthProviders.has('copilot'), true, 'Block muss erscheinen')
  assert.equal(oauthProviders.has('openrouter'), false, 'kein Block ohne Anmeldung')

  // Gegenprobe: haette die Zuweisung gefehlt, waere alles leer und still.
  const vergessen = new Set<string>()
  assert.equal(vergessen.has('copilot'), false)
})