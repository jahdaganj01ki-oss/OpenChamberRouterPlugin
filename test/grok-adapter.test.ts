/**
 * Tests für den grok-cli OAuth-Adapter.
 *
 * Stellt sicher, dass der Grok-CLI-Adapter korrekt konfiguriert ist und
 * die Token-Erneuerung funktioniert.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { oauthAdapters, oauthAdapterFor, renewGrok, freshToken } from '../src/service/oauth-adapters.ts'
import { grokDeviceFlow, GROK_CLIENT_ID, GROK_BASE_URL } from '../src/service/oauth.ts'

test('grok-cli ist als OAuth-Adapter registriert', () => {
  assert.ok(oauthAdapters['grok-cli'], 'grok-cli-Adapter muss existieren')
  assert.equal(oauthAdapters['grok-cli'].id, 'grok-cli')
  assert.equal(oauthAdapters['grok-cli'].auth, 'oauth')
  assert.equal(oauthAdapters['grok-cli'].baseUrl, GROK_BASE_URL)
})

test('oauthAdapterFor liefert den grok-cli-Adapter', () => {
  const adapter = oauthAdapterFor('grok-cli')
  assert.ok(adapter, 'oauthAdapterFor muss den Adapter finden')
  assert.equal(adapter?.id, 'grok-cli')
})

test('grokDeviceFlow hat die richtigen Endpunkte', () => {
  assert.equal(grokDeviceFlow.clientId, GROK_CLIENT_ID)
  assert.equal(grokDeviceFlow.deviceCodeUrl, 'https://auth.x.ai/oauth2/device/code')
  assert.equal(grokDeviceFlow.tokenUrl, 'https://auth.x.ai/oauth/token')
  assert.ok(grokDeviceFlow.scope.includes('grok-cli:access'), 'Scope muss grok-cli:access enthalten')
  assert.ok(grokDeviceFlow.scope.includes('api:access'), 'Scope muss api:access enthalten')
})

test('freshToken erneuert nur abgelaufene Tokens', async () => {
  // Gültiges Token: keine Erneuerung notwendig
  const valid = {
    refreshToken: 'refresh123',
    accessToken: 'access456',
    expiresAt: Date.now() + 120_000, // 2 Minuten gültig
  }

  let renewed = false
  const result = await freshToken(valid, async () => {
    renewed = true
    return { accessToken: 'new_access', expiresAt: Date.now() + 3600_000 }
  })

  assert.equal(renewed, false, 'Token ist noch gültig, keine Erneuerung nötig')
  assert.equal(result.accessToken, 'access456', 'Original-Token bleibt erhalten')
})

test('freshToken erneuert abgelaufene Tokens', async () => {
  const expired = {
    refreshToken: 'refresh123',
    accessToken: 'old_access',
    expiresAt: Date.now() - 1_000, // vor 1 Sekunde abgelaufen
  }

  let renewed = false
  const result = await freshToken(expired, async (refreshToken) => {
    renewed = true
    assert.equal(refreshToken, 'refresh123', 'Refresh-Token wird weitergegeben')
    return { accessToken: 'new_access', expiresAt: Date.now() + 3600_000 }
  })

  assert.equal(renewed, true, 'Token ist abgelaufen, Erneuerung nötig')
  assert.equal(result.accessToken, 'new_access')
})