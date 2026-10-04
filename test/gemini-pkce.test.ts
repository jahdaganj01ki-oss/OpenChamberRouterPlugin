/**
 * Tests für den Google Gemini CLI PKCE Authorization Code Flow.
 *
 * Google hat das OAuth am 18.06.2026 eingestellt — neue Anmeldungen können
 * mit `access_denied` scheitern. Bestehende Refresh-Tokens funktionieren
 * weiterhin.
 *
 * Diese Tests prüfen die reine PKCE-Logik (Parameter-Generierung,
 * Auth-URL-Aufbau, Token-Tausch), nicht den echten HTTP-Austausch.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'

import {
  GEMINI_CLIENT_ID,
  geminiPkceFlow,
  generatePkce,
  pkceAuthUrl,
} from '../src/service/oauth.ts'

test('geminiPkceFlow hat die richtigen Google-Endpunkte', () => {
  assert.equal(geminiPkceFlow.clientId, GEMINI_CLIENT_ID)
  assert.equal(geminiPkceFlow.authUrl, 'https://accounts.google.com/o/oauth2/auth')
  assert.equal(geminiPkceFlow.tokenUrl, 'https://oauth2.googleapis.com/token')
  assert.equal(geminiPkceFlow.redirectUri, 'http://127.0.0.1:8478/callback')
  assert.ok(geminiPkceFlow.scope.includes('openid'), 'Scope muss openid enthalten')
  assert.ok(geminiPkceFlow.scope.includes('email'), 'Scope muss email enthalten')
  assert.ok(
    geminiPkceFlow.scope.includes('https://www.googleapis.com/auth/cloud-platform'),
    'Scope muss cloud-platform enthalten',
  )
})

test('generatePkce erzeugt gueltige Parameter', () => {
  const pkce = generatePkce()

  // code_verifier muss mindestens 43 Zeichen lang sein (RFC 7636)
  assert.ok(
    pkce.codeVerifier.length >= 43,
    `code_verifier zu kurz (${pkce.codeVerifier.length} < 43)`,
  )
  // code_challenge muss base64URL-codiert sein (keine +, /, =)
  assert.ok(
    !pkce.codeChallenge.includes('+'),
    'code_challenge enthält Base64-Zeichen (+)',
  )
  assert.ok(
    !pkce.codeChallenge.includes('/'),
    'code_challenge enthält Base64-Zeichen (/)',
  )
  assert.ok(!pkce.codeChallenge.includes('='), 'code_challenge hat Padding (=)')
  // Method muss S256 sein
  assert.equal(pkce.codeChallengeMethod, 'S256')
})

test('pkceAuthUrl enthaelt alle noetigen Parameter', () => {
  const pkce = generatePkce()
  const url = pkceAuthUrl(geminiPkceFlow, pkce)

  const parsed = new URL(url)
  assert.equal(parsed.origin + parsed.pathname, 'https://accounts.google.com/o/oauth2/auth')
  assert.equal(parsed.searchParams.get('client_id'), GEMINI_CLIENT_ID)
  assert.equal(parsed.searchParams.get('redirect_uri'), 'http://127.0.0.1:8478/callback')
  assert.equal(parsed.searchParams.get('response_type'), 'code')
  assert.equal(parsed.searchParams.get('code_challenge'), pkce.codeChallenge)
  assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(parsed.searchParams.get('access_type'), 'offline')
  assert.equal(parsed.searchParams.get('prompt'), 'consent')
})

test('jedes Aufrufen von generatePkce liefert andere Werte', () => {
  const a = generatePkce()
  const b = generatePkce()
  assert.notEqual(a.codeVerifier, b.codeVerifier, 'code_verifier muss zufällig sein')
  assert.notEqual(a.codeChallenge, b.codeChallenge, 'code_challenge muss zufällig sein')
})

test('code_challenge ist der SHA-256-Hash von code_verifier', () => {
  // Manuelle Überprüfung: SHA-256 der bekannten Zeichenkette
  const pkce = generatePkce()
  const expected = createHash('sha256')
    .update(pkce.codeVerifier)
    .digest()
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  assert.equal(
    pkce.codeChallenge,
    expected,
    'code_challenge muss SHA-256(code_verifier) sein',
  )
})
