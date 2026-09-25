/** Keep the real action row in the preview's own scrollport. */
export function focusButtonActions(viewport: HTMLElement): boolean {
  const row = viewport.querySelector<HTMLElement>(".mono-actions");
  if (!row || viewport.clientHeight <= 0) return false;
  const rowRect = row.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  if (rowRect.height <= 0) return false;
  const inset = Math.max(12, (viewport.clientHeight - rowRect.height) / 2);
  const desired = viewport.scrollTop + rowRect.top - viewportRect.top - inset;
  viewport.scrollTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, Math.round(desired)));
  return true;
}
