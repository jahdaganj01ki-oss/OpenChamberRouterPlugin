/**
 * Wird beim Bauen durch `scripts/build.mjs` ersetzt und zeigt der Seite, welchen
 * Stand sie wirklich fährt. Ohne das lässt sich ein altes Bundle nicht von einem
 * neuen unterscheiden – und ein altes Bundle sieht aus wie ein Fehler im Code,
 * den man gerade geschrieben hat.
 */
declare const __BUILD_ID__: string
