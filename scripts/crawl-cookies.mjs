#!/usr/bin/env node
/**
 * crawl-cookies.mjs — Playwright-basierter Cookie-Crawler
 *
 * Wird für Web-Cookie-Anbieter (z.B. claude-web, grok-web) verwendet.
 * Startet einen Browser, navigiert zu der Anbieter-Website, wartet bis der
 * Nutzer sich eingeloggt hat, und extrahiert die Session-Cookies.
 *
 * Nutzung:
 *   npm run crawl-cookies -- <provider-id>
 *
 * Beispiel:
 *   npm run crawl-cookies -- claude-web
 *
 * Die gefundenen Cookies werden als JSON auf stdout ausgegeben, die der
 * Nutzer in die OpenChamber-Konfiguration einfügen kann.
 */
import { chromium } from 'playwright';

// Provider-Konfiguration: Domain und Cookie-Name
const PROVIDER_CONFIG = {
  'claude-web': {
    url: 'https://claude.ai/login',
    cookieNames: ['session_id', '__Host-session_id', 'session', '__Secure-session'],
    instructions: 'Bitte melde dich bei Claude.ai an, dann drücke Enter.',
  },
  'grok-web': {
    url: 'https://x.com/i/flow/login',
    cookieNames: ['session', 'auth_token', 'ct0'],
    instructions: 'Bitte melde dich bei x.com/Grok an, dann drücke Enter.',
  },
};

const providerId = process.argv[2];
const config = PROVIDER_CONFIG[providerId];

if (!config) {
  console.error('Unbekannter Provider:', providerId);
  console.error('Verfügbare:', Object.keys(PROVIDER_CONFIG).join(', '));
  process.exit(1);
}

console.log('=== Cookie-Crawler für', providerId, '===');
console.log('Anweisungen:', config.instructions);
console.log('');

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') {
    console.error('Browser-Fehler:', msg.text());
  }
});

// Navigate to login page
console.log('Öffne:', config.url);
await page.goto(config.url);

// Wait for user to log in
console.log('\nBitte melde dich an. Drücke STRG+C zum Abbrechen.');
console.log('Nach der Anmeldung, drücke Enter in dieses Terminal...\n');

// Wait for Enter in stdin
await new Promise((resolve) => {
  process.stdin.once('data', () => resolve());
});

// Wait a bit for cookies to be set
await new Promise(r => setTimeout(r, 2000));

// Extract cookies
const cookies = await context.cookies();
const relevantCookies = cookies.filter(c =>
  config.cookieNames.some(name =>
    c.name === name || c.name.startsWith(name.split('_')[0])
  )
);

console.log('\n=== Gefundene Cookies ===');
console.log(JSON.stringify(relevantCookies, null, 2));

// Also extract all cookies for reference
console.log('\n=== Alle Cookies (zum Vergleich) ===');
console.log(JSON.stringify(cookies, null, 2));

// Format for easy copy-paste
console.log('\n=== Cookie-String für Konfiguration ===');
const cookieString = relevantCookies
  .map(c => `${c.name}=${c.value}`)
  .join('; ');
console.log(cookieString);

await browser.close();
console.log('\nBrowser geschlossen.');
