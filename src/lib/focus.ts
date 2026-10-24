/** Tabbable controls in their DOM order, excluding closed disclosures. */
export function tabStops(roots: HTMLElement[]): HTMLElement[] {
  const selector = 'a[href], button, input, select, textarea, summary, [tabindex]';
  return roots.flatMap((root) => [root, ...root.querySelectorAll<HTMLElement>(selector)])
    .filter((element) => {
      if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert]')) return false;
      if (!element.checkVisibility({ visibilityProperty: true })) return false;
      // Some browsers still give descendants of closed details a layout box.
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement && !parent.open) {
          const summary = parent.querySelector(':scope > summary');
          if (!summary?.contains(element)) return false;
        }
      }
      return true;
    });
}

export function trapTabFocus(event: KeyboardEvent, roots: HTMLElement[]) {
  if (event.key !== 'Tab') return;
  const controls = tabStops(roots);
  if (!controls.length) return;
  const index = controls.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey
    ? (index <= 0 ? controls.length - 1 : index - 1)
    : (index + 1) % controls.length;
  event.preventDefault();
  controls[next].focus();
}

/** Restore pre-existing inert state when the temporary overlay closes. */
export function makeInert(elements: HTMLElement[]) {
  const previous = elements.map((element) => element.inert);
  elements.forEach((element) => { element.inert = true; });
  return () => elements.forEach((element, index) => { element.inert = previous[index]; });
}
