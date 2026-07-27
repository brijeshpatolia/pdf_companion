/**
 * Where the select-to-ask popover goes.
 *
 * Two things went wrong on a phone and both are decided here.
 *
 * The popover was centred on the selection with no regard for the pane it
 * lives in, which is fine at 1180px and not fine at 393px: four buttons in a
 * row is nearly the whole screen, so selecting anything near an edge pushed
 * half the popover off it.
 *
 * And it always sat *above* the selection — which is exactly where Android
 * puts its own Copy / Share / Select-all bar. The two landed on top of each
 * other and the platform's won, so the reader's actions were on screen and
 * unreachable. Clearing the selection should take that bar away with it, but
 * preferring the other side costs nothing and means a bar that outlives the
 * selection on some device sits beside ours rather than over it.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The visible part of the scrolling pane, in the same space as everything else. */
export interface View extends Size {
  left: number;
  top: number;
}

/** Between the popover and the text it belongs to. */
const GAP = 10;
/** Between the popover and the edge of the pane. */
const GUTTER = 8;

export function placePopover(
  selection: Rect,
  view: View,
  popover: Size,
  preferBelow: boolean,
): { left: number; top: number } {
  const above = selection.top - GAP - popover.height;
  const below = selection.bottom + GAP;
  const fitsAbove = above >= view.top + GUTTER;
  const fitsBelow = below + popover.height <= view.top + view.height - GUTTER;

  // The preferred side, then the other, then the preferred one anyway — with a
  // selection taller than the pane there is no good answer, only a consistent
  // one.
  const top = preferBelow
    ? fitsBelow || !fitsAbove
      ? below
      : above
    : fitsAbove || !fitsBelow
      ? above
      : below;

  const wanted = (selection.left + selection.right) / 2 - popover.width / 2;
  const min = view.left + GUTTER;
  const max = view.left + view.width - GUTTER - popover.width;

  // A popover wider than the pane has no position that satisfies both edges,
  // so it is centred and overflows evenly rather than being jammed against one
  // of them.
  const left =
    max < min
      ? view.left + (view.width - popover.width) / 2
      : Math.min(Math.max(wanted, min), max);

  return { left: Math.round(left), top: Math.round(top) };
}
