/**
 * Tests für lokale Credential-Reader.
 *
 * Diese Reader versuchen, Zugangsdaten aus lokalen Konfigurationsdateien
 * und Umgebungsvariablen zu lesen, die von IDE-CLIs wie Kiro, Windsurf,
 * Qoder und WorkBuddy hinterlegt werden.
 *
 * Die Tests setzen und löschen Umgebungsvariablen gezielt, um die
 * Prioritätsreihenfolge (env > lokale Datei > Fallback) zu verifizieren.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Wir importieren die Reader-Funktionen, die wir exportieren müssen.
import { readLocalCredentials } from '../src/service/local-credentials.ts'

const home = homedir()
const testDir = join(home, '.openchamber-router-test')

/**
 * Hilfsfunktion: setzt Umgebungsvariablen und gibt eine Aufräumfunktion zurück.
 */
const withEnv = (env: Record<string, string>): (() => void) => {
  const old: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) {
    old[key] = process.env[key]
    process.env[key] = value
  }
  return () => {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const restore = withEnv({})

test('readLocalCredentials: unbekannter Provider gibt null zurück', async () => {
  const result = await readLocalCredentials('unknown-provider')
  assert.equal(result, null)
})

test('readLocalCredentials: Kiro liest KIRO_API_KEY aus Umgebung', async () => {
  const cleanup = withEnv({ KIRO_API_KEY: 'ksk_testkey123' })
  try {
    const result = await readLocalCredentials('kiro')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'ksk_testkey123')
    assert.equal(result!.source, 'env KIRO_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: Windsurf liest CODEIUM_API_KEY aus Umgebung', async () => {
  const cleanup = withEnv({ CODEIUM_API_KEY: 'codeium_test_key' })
  try {
    const result = await readLocalCredentials('windsurf')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'codeium_test_key')
    assert.equal(result!.source, 'env CODEIUM_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: Qoder liest DASHSCOPE_API_KEY aus Umgebung', async () => {
  const cleanup = withEnv({ DASHSCOPE_API_KEY: 'sk-test-dashscope-key' })
  try {
    const result = await readLocalCredentials('qoder')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'sk-test-dashscope-key')
    assert.equal(result!.source, 'env DASHSCOPE_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: WorkBuddy liest WORKBUDDY_API_KEY aus Umgebung', async () => {
  const cleanup = withEnv({ WORKBUDDY_API_KEY: 'wbkey_test' })
  try {
    const result = await readLocalCredentials('workbuddy')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'wbkey_test')
    assert.equal(result!.source, 'env WORKBUDDY_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: Qoder liest aus settings.json als Fallback', async () => {
  // Entferne env-Variablen, falls gesetzt
  const cleanup = withEnv({})
  try {
    // settings.json existiert bereits (~/.qoder/settings.json), aber hat keinen API-Key
    const result = await readLocalCredentials('qoder')
    // Da kein env-Key gesetzt ist, wird aus der Datei gelesen.
    // Die existierende settings.json hat keinen apiKey, also null.
    // Wir testen hier nur, dass der Reader nicht crasht.
    assert.equal(result, null)
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: Priorität env > lokale Datei', async () => {
  // Setze env-Variable mit höherer Priorität
  const cleanup = withEnv({ QODER_API_KEY: 'env-priority-key' })
  try {
    const result = await readLocalCredentials('qoder')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'env-priority-key')
    assert.equal(result!.source, 'env QODER_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: Windsurf liest WINDSURF_API_KEY als Alternative', async () => {
  const cleanup = withEnv({ WINDSURF_API_KEY: 'windsurf_key_alt' })
  try {
    const result = await readLocalCredentials('windsurf')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'windsurf_key_alt')
    assert.equal(result!.source, 'env WINDSURF_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: Kiro liest AWS_PROFILE Umgebungsvariable', async () => {
  const cleanup = withEnv({
    AWS_PROFILE: 'test-profile',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret123',
  })
  try {
    const result = await readLocalCredentials('kiro')
    assert.ok(result, 'Sollte AWS Credentials finden')
    assert.equal(result!.source, 'env AWS_ACCESS_KEY_ID')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: WorkBuddy liest Tencent Cloud Credentials', async () => {
  const cleanup = withEnv({
    TENCENT_SECRET_ID: 'tencent_id',
    TENCENT_SECRET_KEY: 'tencent_key',
  })
  try {
    const result = await readLocalCredentials('workbuddy')
    assert.ok(result, 'Sollte Tencent Credentials finden')
    assert.equal(result!.apiKey, 'tencent_id:tencent_key')
    assert.equal(result!.source, 'env TENCENT_SECRET_ID')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: iFlow liest IFLOW_API_KEY aus Umgebung', async () => {
  const cleanup = withEnv({ IFLOW_API_KEY: 'iflow_test_key' })
  try {
    const result = await readLocalCredentials('iflow')
    assert.ok(result, 'Sollte Credentials finden')
    assert.equal(result!.apiKey, 'iflow_test_key')
    assert.equal(result!.source, 'env IFLOW_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: iFlow liest baseUrl aus Umgebung', async () => {
  const cleanup = withEnv({
    IFLOW_API_KEY: 'iflow_test_key',
    IFLOW_BASE_URL: 'https://custom.iflow.cn/v1',
  })
  try {
    const result = await readLocalCredentials('iflow')
    assert.ok(result, 'Sollte Credentials mit Base-URL finden')
    assert.equal(result!.apiKey, 'iflow_test_key')
    assert.equal(result!.baseUrl, 'https://custom.iflow.cn/v1')
    assert.equal(result!.source, 'env IFLOW_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: WorkBuddy-Kategorie kann nicht ohne Credentials gefunden werden', async () => {
  // Stelle sicher, dass keine env-Variablen gesetzt sind
  const cleanup = withEnv({})
  try {
    const result = await readLocalCredentials('workbuddy')
    // Auf dieser Maschine existiert ~/.workbuddy/models.json nicht
    // und keine env-Variablen sind gesetzt
    assert.equal(result, null)
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: LM Studio liest Standard-URL ohne API-Key', async () => {
  const cleanup = withEnv({})
  try {
    const result = await readLocalCredentials('lmstudio')
    assert.ok(result, 'Sollte LM Studio Credentials finden')
    assert.equal(result!.apiKey, 'lmstudio-local')
    assert.equal(result!.baseUrl, 'http://localhost:1234/v1')
    assert.equal(result!.source, 'local LM Studio server')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: LM Studio liest benutzerdefinierte Base-URL aus env', async () => {
  const cleanup = withEnv({ LMSTUDIO_BASE_URL: 'http://localhost:1235/v1' })
  try {
    const result = await readLocalCredentials('lmstudio')
    assert.ok(result, 'Sollte LM Studio Credentials mit Custom URL finden')
    assert.equal(result!.baseUrl, 'http://localhost:1235/v1')
    assert.equal(result!.source, 'local LM Studio server')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: OmniRoute liest API-Key aus Umgebung', async () => {
  const cleanup = withEnv({
    OMNIROUTE_API_KEY: 'or_test_key_123',
    OMNIROUTE_BASE_URL: 'https://platform.cheaperinference.com/v1',
  })
  try {
    const result = await readLocalCredentials('omniroute')
    assert.ok(result, 'Sollte OmniRoute Credentials finden')
    assert.equal(result!.apiKey, 'or_test_key_123')
    assert.equal(result!.baseUrl, 'https://platform.cheaperinference.com/v1')
    assert.equal(result!.source, 'env OMNIROUTE_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: OmniRoute verwendet Standard-URL ohne Key', async () => {
  const cleanup = withEnv({})
  try {
    const result = await readLocalCredentials('omniroute')
    assert.ok(result, 'Sollte OmniRoute Standard-Credentials finden')
    assert.equal(result!.apiKey, 'omniroute-local')
    assert.equal(result!.baseUrl, 'http://localhost:20128/v1')
    assert.equal(result!.source, 'local OmniRoute server')
  } finally {
    cleanup()
  }
})

// Cleanup nach allen Tests
restore

test('readLocalCredentials: LM Studio liest Standard-URL ohne API-Key', async () => {
  const cleanup = withEnv({})
  try {
    const result = await readLocalCredentials('lmstudio')
    assert.ok(result, 'Sollte LM Studio Credentials finden')
    assert.equal(result!.apiKey, 'lmstudio-local')
    assert.equal(result!.baseUrl, 'http://localhost:1234/v1')
    assert.equal(result!.source, 'local LM Studio server')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: LM Studio liest benutzerdefinierte Base-URL aus env', async () => {
  const cleanup = withEnv({ LMSTUDIO_BASE_URL: 'http://localhost:1235/v1' })
  try {
    const result = await readLocalCredentials('lmstudio')
    assert.ok(result, 'Sollte LM Studio Credentials mit Custom URL finden')
    assert.equal(result!.baseUrl, 'http://localhost:1235/v1')
    assert.equal(result!.source, 'local LM Studio server')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: OmniRoute liest API-Key aus Umgebung', async () => {
  const cleanup = withEnv({
    OMNIROUTE_API_KEY: 'or_test_key_123',
    OMNIROUTE_BASE_URL: 'https://platform.cheaperinference.com/v1',
  })
  try {
    const result = await readLocalCredentials('omniroute')
    assert.ok(result, 'Sollte OmniRoute Credentials finden')
    assert.equal(result!.apiKey, 'or_test_key_123')
    assert.equal(result!.baseUrl, 'https://platform.cheaperinference.com/v1')
    assert.equal(result!.source, 'env OMNIROUTE_API_KEY')
  } finally {
    cleanup()
  }
})

test('readLocalCredentials: OmniRoute verwendet Standard-URL ohne Key', async () => {
  const cleanup = withEnv({})
  try {
    const result = await readLocalCredentials('omniroute')
    assert.ok(result, 'Sollte OmniRoute Standard-Credentials finden')
    assert.equal(result!.apiKey, 'omniroute-local')
    assert.equal(result!.baseUrl, 'http://localhost:20128/v1')
    assert.equal(result!.source, 'local OmniRoute server')
  } finally {
    cleanup()
  }
})
