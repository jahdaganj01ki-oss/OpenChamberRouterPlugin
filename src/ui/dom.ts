/**
 * Kleine DOM-Helfer.
 *
 * Die UI-Kit exportiert absichtlich nur ihre `mount*`-Funktionen; fuer das
 * Raster, die Abstandshalter und die eigene CSS-Ergänzung brauchen wir echtes
 * DOM. Der Stil der Kit wird von jeder Komponente selbst injiziert, hier
 * kommt nur Oureres dazu.
 */

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

/** Schreibt Text nur bei Aenderung, damit Auswahl und Layout nicht springen. */
export const setText = (node: Node, text: string | null | undefined): void => {
  const value = text ?? ''
  if (node.textContent !== value) node.textContent = value
}

export const clearNode = (node: Node): void => {
  while (node.firstChild) node.removeChild(node.firstChild)
}

/** Platzhalter mit fester Hoehe, damit Abstaende nicht per Padding entstehen. */
export const spacer = (px: number): HTMLElement => {
  const node = el('div')
  node.style.height = `${px}px`
  return node
}

const injected = new Set<string>()

/**Fuegt ein Style-Block genau einmal ein. `id` muss eindeutig sein. */
export const ensureStyle = (id: string, css: string): void => {
  if (injected.has(id)) return
  injected.add(id)
  if (document.getElementById(id)) return
  const node = document.createElement('style')
  node.id = id
  node.textContent = css
  document.head.append(node)
}
