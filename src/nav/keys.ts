/*
 * This file is part of OpenTV Lite.
 * Copyright (C) 2026 The OpenTV Contributors
 * Licensed under the GNU General Public License v3.0 or later.
 */
import { useEffect, useRef } from "preact/hooks";
import { keyFromEvent, type Key } from "../platform/keys";

/**
 * Remote input routing. A TV has one focus and one remote, so instead of the browser's own
 * focus model every screen registers a key handler and the most recently mounted one (the
 * screen or overlay on top) receives the keys. Explicit index-based focus inside each screen
 * is predictable on a D-pad and cheap on slow TV hardware.
 */
type Handler = (key: Key) => boolean | void;

const stack: { current: Handler }[] = [];

export function installKeyRouter(): void {
  document.addEventListener(
    "keydown",
    (e) => {
      const key = keyFromEvent(e);
      if (!key) return;
      const top = stack[stack.length - 1];
      if (!top) return;
      const handled = top.current(key);
      if (handled !== false) e.preventDefault();
    },
    true,
  );
}

/** Registers `handler` while the component is mounted and `active` is true. */
export function useKeys(handler: Handler, active = true): void {
  const ref = useRef<Handler>(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const entry = {
      get current() {
        return ref.current;
      },
    } as { current: Handler };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Moves an index within [0, count) without wrapping. */
export function clampIndex(i: number, count: number): number {
  if (count <= 0) return 0;
  return i < 0 ? 0 : i >= count ? count - 1 : i;
}
