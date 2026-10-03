/**
 * Helfer fuer Umbauten am Quelltext.
 *
 * Ein `String.replace`, das sein Muster nicht findet, meldet Erfolg – so sind
 * in diesem Projekt Fehler unbemerkt geblieben. Ausserdem ersetzt `replace`
 * ohne Flag nur das erste Vorkommen, wodurch zweite Stellen mit dem alten
 * Wert stehen blieben. Beides passiert hier jetzt laut.
 */

/** Ersetzt alle Vorkommen oder bricht ab. */
export const replaceAll = (path, was, wird) => {
  const vorher = readFileSync(path, 'utf8')
  const nachher = vorher.split(was).join(wird)
  if (vorher === nachher) {
    console.error(`Nichts geaendert in ${path}: ${JSON.stringify(was)}`)
    process.exit(1)
  }
  writeFileSync(path, nachher, 'utf8')
  const anzahl = vorher.split(was).length - 1
  console.log(`${path}: ${anzahl} Ersetzung(en)`)
}

/** Ersetzt eine Liste von Mustern, prueft jedes einzeln. */
export const patch = (path, pairs) => {
  let text = readFileSync(path, 'utf8')
  for (const [was, wird] of pairs) {
    if (!text.includes(was)) {
      console.error(
        `Muster nicht gefunden in ${path}:\n---\n${was.slice(0, 200)}\n---`,
      )
      process.exit(1)
    }
    text = text.replace(was, wird)
  }
  writeFileSync(path, text, 'utf8')
  console.log(`${path}: ${pairs.length} Ersetzung(en)`)
}

import { readFileSync, writeFileSync } from 'node:fs'