/**
 * Die UI-Kit merkt sich ihren Zustand nicht.
 *
 * Jede Komponente meldet in `onChange` den Wert, mit dem sie zuletzt gezeichnet
 * wurde – bis der Aufrufer `update()` sagt, was jetzt gilt. Wer das vergisst,
 * kann ein Kaestchen einschalten, aber nie wieder ausschalten: das Kaestchen
 * zeichnet nie neu, und jeder Klick meldet denselben Wert.
 *
 * Diese Tests halten die Falle fest und die Abhilfe.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
}

/** Nachbau des Verhaltens aus `checkbox.js` der UI-Kit. */
const mountToggle = (initial: ToggleProps) => {
  let props = initial
  return {
    click: (): void => props.onChange(!props.checked),
    update: (next: Partial<ToggleProps>): void => {
      props = { ...props, ...next }
    },
    get checked(): boolean {
      return props.checked
    },
  }
}

test('die Falle: ohne update() bleibt der Wert stehen', () => {
  const box = mountToggle({ checked: false, onChange: () => {} })

  box.click()
  // onChange hat zwar `true` gemeldet, aber `props` ist unveraendert: die
  // Komponente zeichnet also nicht neu, und der Wert bleibt `false`.
  assert.equal(box.checked, false)

  // Genau darum war im Bild nichts zu sehen – und warum ein zweiter Klick
  // wieder dasselbe meldet statt umzuschalten.
  const seen: boolean[] = []
  const broken = mountToggle({ checked: false, onChange: (n) => seen.push(n) })
  broken.click()
  broken.click()
  broken.click()
  assert.deepEqual(seen, [true, true, true])
})

test('mit update() ist der Wert wiederkehrend', () => {
  const seen: boolean[] = []
  const box = mountToggle({
    checked: false,
    onChange: (next) => {
      seen.push(next)
      box.update({ checked: next })
    },
  })
  box.click()
  box.click()
  box.click()
  assert.deepEqual(seen, [true, false, true])
})

test('Modellauswahl laesst sich wieder abwaehlen', () => {
  const chosen = new Set<string>()
  const box = mountToggle({
    checked: false,
    onChange: (next) => {
      if (next) chosen.add('modell-a')
      else chosen.delete('modell-a')
      box.update({ checked: next })
    },
  })
  box.click()
  assert.equal(chosen.has('modell-a'), true)
  box.click()
  assert.equal(chosen.has('modell-a'), false)
})

test('Filter „nur kostenlose“ laesst sich wieder ausschalten', () => {
  let onlyFree = false
  const box = mountToggle({
    checked: false,
    onChange: (next) => {
      onlyFree = next
      box.update({ checked: next })
    },
  })
  box.click()
  assert.equal(onlyFree, true)
  box.click()
  assert.equal(onlyFree, false)
  box.click()
  assert.equal(onlyFree, true)
})
