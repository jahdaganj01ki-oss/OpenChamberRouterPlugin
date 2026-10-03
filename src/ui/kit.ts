/**
 * Dünne Wrapper um die UI-Kit.
 *
 * Die Kit haengt ihre Elemente selbst in den Container, den sie als erstes
 * Argument bekommt, und gibt nur `{ update, dispose }` zurueck. Fuer den
 * Aufbau-Code ist es angenehmer, einfach `parent` zu uebergeben: diese Helfer
 * erzeugen den Container, haengen ihn an und liefern den Handle.
 */

import {
  mountBadge,
  mountBanner,
  mountButton,
  mountCheckbox,
  mountEmpty,
  mountSearchField,
  mountSelect,
  mountSpinner,
  mountSwitch,
  mountTextField,
  type BadgeHandle,
  type BadgeProps,
  type ButtonHandle,
  type ButtonProps,
  type CheckboxHandle,
  type CheckboxProps,
  type EmptyHandle,
  type EmptyProps,
  type SearchFieldHandle,
  type SearchFieldProps,
  type SelectHandle,
  type SelectOption,
  type SelectProps,
  type SpinnerHandle,
  type SpinnerProps,
  type TextFieldHandle,
  type TextFieldProps,
} from '@openchamber/sdk/ui'

/** Frischer Container, an `parent` gehaengt. */
export const host = (parent: Element, className?: string): HTMLElement => {
  const node = document.createElement('div')
  if (className) node.className = className
  parent.append(node)
  return node
}

export const addBadge = (parent: Element, props: BadgeProps): BadgeHandle =>
  mountBadge(host(parent), props)

export const addButton = (parent: Element, props: ButtonProps): ButtonHandle =>
  mountButton(host(parent), props)

export const addCheckbox = (parent: Element, props: CheckboxProps): CheckboxHandle =>
  mountCheckbox(host(parent), props)

export const addSwitch = (parent: Element, props: CheckboxProps): CheckboxHandle =>
  mountSwitch(host(parent), props)

export const addSelect = (parent: Element, props: SelectProps): SelectHandle =>
  mountSelect(host(parent), props)

export const addTextField = (parent: Element, props: TextFieldProps): TextFieldHandle =>
  mountTextField(host(parent), props)

export const addSearchField = (
  parent: Element,
  props: SearchFieldProps,
): SearchFieldHandle => mountSearchField(host(parent), props)

export const addSpinner = (parent: Element, props?: SpinnerProps): SpinnerHandle =>
  mountSpinner(host(parent), props)

export const addEmpty = (parent: Element, props: EmptyProps): EmptyHandle =>
  mountEmpty(host(parent), props)

export const addBanner = (
  parent: Element,
  props: Parameters<typeof mountBanner>[1],
): ReturnType<typeof mountBanner> => mountBanner(host(parent), props)


/**
 * Checkbox, die ihren Zustand selbst spiegelt.
 *
 * Die Kit haelt keinen eigenen Zustand: `onChange` liefert immer den Wert
 * zurueck, mit dem sie zuletzt gezeichnet wurde, bis der Aufrufer `update()`
 * sagt, was jetzt gilt. Wer das vergisst, kann ein Kaestchen einschalten,
 * aber nie wieder ausschalten – jeder Klick meldet denselben Wert.
 *
 * Dieser Wrapper spiegelt nach jedem Klick und gibt trotzdem den Handle
 * zurueck, falls jemand von aussen setzen will.
 */
export const addToggle = (parent: Element, props: CheckboxProps): CheckboxHandle => {
  const handle = mountCheckbox(host(parent), {
    ...props,
    onChange: (next) => {
      handle.update({ checked: next })
      props.onChange(next)
    },
  })
  return handle
}

/** Wie `addToggle`, aber als Schalter. */
export const addSelfSwitch = (parent: Element, props: CheckboxProps): CheckboxHandle => {
  const handle = mountSwitch(host(parent), {
    ...props,
    onChange: (next) => {
      handle.update({ checked: next })
      props.onChange(next)
    },
  })
  return handle
}

export type { SelectOption }
