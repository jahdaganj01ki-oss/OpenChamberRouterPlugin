/**
 * Tests für die Provider-Adapter-Implementierung.
 *
 * Stellt sicher, dass alle Provider im Katalog auch im Dienst bedient werden,
 * und dass die Auth-Methoden korrekt sind.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { adapters } from '../src/service/adapters.ts'
import { gatewayAdapters, mediaAdapters } from '../src/service/gateways.ts'
import { oauthAdapters } from '../src/service/oauth-adapters.ts'
import { providers, type Provider } from '../src/providers/catalog.ts'
import type { AuthKind } from '../src/shared/contract.ts'

/** Alle Adapter, die der Dienst kennt. */
const allAdapters = { ...gatewayAdapters, ...adapters, ...oauthAdapters, ...mediaAdapters }

/** Nur Adapter mit vollem Auth-Interface. */
const fullAdapters = { ...gatewayAdapters, ...adapters, ...oauthAdapters }

test('alle API-Key- und Cookie-Provider im Katalog haben einen Adapter', () => {
  const apiProviders = providers.filter(
    (p): p is Provider =>
      (p.auth === 'api-key' || p.auth === 'cookie'),
  )
  const missing = apiProviders.filter((p) => !allAdapters[p.id])
  assert.deepEqual(
    missing.map((p) => p.id),
    [],
    `Diese Provider haben keinen Adapter: ${missing.map((p) => p.id).join(', ')}`,
  )
})

test('grok-cli ist als OAuth-Adapter registriert', () => {
  assert.ok(oauthAdapters['grok-cli'], 'grok-cli OAuth-Adapter fehlt')
})

test('cloudflare-Provider akzeptiert account_id:api_token Format', () => {
  const adapter = fullAdapters['cloudflare-workers-ai']
  if (!adapter?.headers) throw new Error('Fehlende headers-Funktion')
  const headers = adapter.headers('abc123:mytoken')
  assert.equal(headers.Authorization, 'Bearer mytoken', 'Token muss nach dem Doppelpunkt stehen')
})

test('cloudflare-Provider kann Account-ID aus dem Key extrahieren', () => {
  const adapter = fullAdapters['cloudflare']
  if (!adapter?.headers) throw new Error('Fehlende headers-Funktion')
  const headers = adapter.headers('def456:abc789')
  assert.equal(headers.Authorization, 'Bearer abc789')
})

test('grok-web verwendet Cookie-stattdessen Bearer', () => {
  const adapter = fullAdapters['grok-web']
  assert.equal(adapter?.auth, 'cookie', 'grok-web muss cookie-Auth haben')
  if (!adapter?.headers) throw new Error('Fehlende headers-Funktion')
  const headers = adapter.headers('session=abc123; __Host-Token=xyz')
  assert.equal(headers.Cookie, 'session=abc123; __Host-Token=xyz', 'Cookies im Header')
  assert.equal(headers.Authorization, undefined, 'Kein Bearer bei Cookies')
})

test('claude-web verwendet Cookie-Auth mit Claude.ai-Basis-URL', () => {
  const adapter = fullAdapters['claude-web']
  assert.equal(adapter?.auth, 'cookie', 'claude-web muss cookie-Auth haben')
  assert.equal(adapter?.baseUrl, 'https://claude.ai', 'Basis-URL muss claude.ai sein')
  if (!adapter?.headers) throw new Error('Fehlende headers-Funktion')
  const headers = adapter.headers('__Host-claudesid=xyz; __Secure-claudesid=abc')
  assert.equal(headers.Cookie, '__Host-claudesid=xyz; __Secure-claudesid=abc', 'Cookies im Header')
  assert.equal(headers.Authorization, undefined, 'Kein Bearer bei Cookies')
})

test('nace, dify, ollama-cloud und agentrouter sind bedienbar', () => {
  for (const id of ['nace', 'dify', 'ollama-cloud', 'agentrouter']) {
    assert.ok(allAdapters[id], `${id} fehlt im Adapter`)
    assert.equal(allAdapters[id].auth, 'api-key')
  }
})

test('gemini-cli ist als OAuth-Adapter registriert', () => {
  assert.ok(oauthAdapters['gemini-cli'], 'gemini-cli OAuth-Adapter fehlt')
  assert.equal(oauthAdapters['gemini-cli'].id, 'gemini-cli')
  assert.equal(oauthAdapters['gemini-cli'].auth, 'oauth')
})

test('gemini-cli verwendet Google Gemini API als Basis-URL', () => {
  const adapter = oauthAdapters['gemini-cli']
  if (!adapter) throw new Error('gemini-cli OAuth-Adapter fehlt')
  assert.equal(
    adapter.baseUrl,
    'https://generativelanguage.googleapis.com/v1beta',
    'Basis-URL muss Google Gemini API sein',
  )
})

test('alle Provider im Katalog tragen einen bekannten Auth-Wert', () => {
  const bekannt: AuthKind[] = ['api-key', 'oauth', 'cookie', 'none', 'local']
  const fremd = providers
    .map((p) => p.auth)
    .filter((a): a is AuthKind => !bekannt.includes(a))
  assert.deepEqual([...new Set(fremd)], [], 'unbekannte Auth-Werte im Katalog')
})