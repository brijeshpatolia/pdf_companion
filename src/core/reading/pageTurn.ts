/**
 * What a page change should look like.
 *
 * A book is bound at the spine, so paper pivots — it doesn't slide, and it
 * doesn't dissolve. That gesture says one thing very precisely: *one* page, in
 * a direction. Which is exactly why it can't be used for everything. Typing
 * "412" into the jump box travels four hundred pages, and turning a single
 * leaf to announce it would be a small lie about how far you went.
 *
 * So there are two motions, and the line between them is the whole content of
 * this module: a turn is one leaf, and anything further is a jump.
 */

export type TurnDirection = "forward" | "back";

/** A leaf pivoting on the spine, or a dissolve for a move too far to mime. */
export type TurnKind = "turn" | "jump";

export interface TurnPlan {
  kind: TurnKind;
  direction: TurnDirection;
}

export interface TurnConditions {
  /** Set when the reader has asked their system for less animation. */
  reducedMotion?: boolean;
}

/**
 * How to move from one page to another, or null when nothing should move.
 *
 * Null is a real answer and not a failure: staying put is not a page turn, and
 * neither is anything at all when the reader has asked for stillness.
 */
export function planTurn(
  from: number,
  to: number,
  conditions: TurnConditions = {},
): TurnPlan | null {
  if (conditions.reducedMotion) return null;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;

  const distance = Math.round(to) - Math.round(from);
  if (distance === 0) return null;

  return {
    kind: Math.abs(distance) === 1 ? "turn" : "jump",
    direction: distance > 0 ? "forward" : "back",
  };
}
