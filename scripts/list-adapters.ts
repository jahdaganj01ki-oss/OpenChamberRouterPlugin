/**
 * Listet alle verdrahteten Anbieter mit Basis-URL und der Angabe, ob sie ihre
 * Modelliste selbst abrufen koennen.
 *
 *   npm run list:adapters
 *   bun scripts/list-adapters.ts
 *
 * Damit laesst sich pruefen, ob eine Basis-URL ueberhaupt stimmt:
 *
 *   bun scripts/list-adapters.mjs | ForEach-Object { $p = $_ -split "`t"; $h = ([uri]$p[1]).Host
 *     try { $null = [System.Net.Dns]::GetHostAddresses($h) } catch { "DNS-FEHLER $($p[0])" } }
 */

import { adapters } from '../src/service/adapters.ts'

const rows = Object.values(adapters).map((a) => ({
  id: a.id,
  url: a.baseUrl,
  lists: Boolean(a.listModels),
  auth: a.auth,
}))

for (const r of rows) console.log(`${r.id}\t${r.url}\t${r.lists}\t${r.auth}`)

const withDiscovery = rows.filter((r) => r.lists).length
console.error(
  `${rows.length} Anbieter, davon ${withDiscovery} mit automatischer Modelliste.`,
)