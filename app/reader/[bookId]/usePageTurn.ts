"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { planTurn } from "@/core/reading/pageTurn.js";

/**
 * Turning the page, as paper.
 *
 * The difficulty is that a page turn needs two pages on screen at once, and
 * the reader only ever renders one. Rather than teaching it to render two —
 * which would mean a second PDF render, a second fetch, and a second copy of
 * every highlight — the page you are leaving is *cloned*, pixels and all, and
 * the copy is what moves. React keeps rendering exactly one live page and
 * never learns any of this happened.
 *
 * Which page carries the motion depends on the direction, because that is what
 * paper does. Turning forward, the page you were on lifts away and the next is
 * already lying underneath it. Turning back, the page you are returning to
 * swings in over the one you were on. So forward it's the clone that moves,
 * and back it's the clone that lies still.
 */

export interface PageTurn {
  /** Goes on the live page. */
  paperRef: RefObject<HTMLDivElement | null>;
  /** An empty div the clone is put into. React never gives it children. */
  leafRef: RefObject<HTMLDivElement | null>;
  /**
   * True while the live page is the one moving — that is, while turning back.
   * The page then needs its arriving animation, and the clone behind it needs
   * to sit *behind* it rather than on top.
   */
  arriving: boolean;
  /** Call before the state change, while the page you are leaving is still up. */
  start: (from: number, to: number) => void;
}

export function usePageTurn(): PageTurn {
  const paperRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  /** Bumped per turn, so a finished turn can't clear up after a newer one. */
  const turnRef = useRef(0);
  const [arriving, setArriving] = useState(false);

  const clear = useCallback(() => {
    leafRef.current?.replaceChildren();
    setArriving(false);
  }, []);

  const start = useCallback(
    (from: number, to: number) => {
      const id = ++turnRef.current;
      const finish = () => {
        if (turnRef.current === id) clear();
      };

      const plan = planTurn(from, to, { reducedMotion: prefersReducedMotion() });
      const paper = paperRef.current;
      const slot = leafRef.current;
      if (!plan || !paper || !slot) {
        finish();
        return;
      }

      const leaf = cloneWithPixels(paper);
      if (!leaf) {
        finish();
        return;
      }

      const back = plan.kind === "turn" && plan.direction === "back";
      leaf.classList.add(
        "leaf",
        plan.kind === "jump" ? "leaf-jump" : back ? "leaf-back" : "leaf-forward",
      );
      // Whatever is still turning from the last tap is replaced, not stacked.
      slot.replaceChildren(leaf);

      setArriving(back);
      // Turning back, the thing that moves is the live page — which does not
      // carry its animation until React commits it. The effect below picks it
      // up from there.
      if (!back) settled(leaf, finish);
    },
    [clear],
  );

  useEffect(() => {
    if (!arriving) return;
    const paper = paperRef.current;
    if (!paper) return;
    const id = turnRef.current;
    settled(paper, () => {
      if (turnRef.current === id) clear();
    });
  }, [arriving, clear]);

  return { paperRef, leafRef, arriving, start };
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A copy of the page exactly as it looks right now, picture included.
 *
 * `cloneNode` copies a <canvas> element but not what has been drawn on it, and
 * a PDF page *is* a canvas — so cloning alone yields a blank sheet with a
 * running head on it. The bitmap is blitted across with drawImage rather than
 * round-tripped through toDataURL: no PNG to encode, and nothing left to
 * decode before the first frame of the turn.
 */
function cloneWithPixels(paper: HTMLElement): HTMLElement | null {
  let clone: HTMLElement;
  try {
    clone = paper.cloneNode(true) as HTMLElement;
  } catch {
    return null;
  }

  const from = paper.querySelectorAll("canvas");
  const onto = clone.querySelectorAll("canvas");
  for (let i = 0; i < onto.length; i++) {
    const src = from[i];
    const dst = onto[i];
    if (!src || !dst || src.width === 0 || src.height === 0) continue;
    try {
      dst.getContext("2d")?.drawImage(src, 0, 0);
    } catch {
      // A tainted canvas can't be read back. The leaf then turns without its
      // picture, which is a better answer than not turning at all.
    }
  }
  return clone;
}

/**
 * Runs `done` once every animation on `el` has finished — or immediately, if
 * it has none.
 *
 * The Web Animations API rather than an `animationend` listener, because the
 * clone brings the original's animations along with it: the text layer's own
 * fade-in is inside there, and `animationend` bubbles, so a listener on the
 * leaf would fire early for something that isn't the turn. `getAnimations()`
 * reports only the element's own.
 *
 * A frame's wait first, because an animation named by a class set a moment ago
 * does not exist until styles are next resolved.
 */
function settled(el: Element, done: () => void) {
  requestAnimationFrame(() => {
    const running = el.getAnimations();
    if (running.length === 0) {
      done();
      return;
    }
    void Promise.allSettled(running.map((a) => a.finished)).then(done);
  });
}
