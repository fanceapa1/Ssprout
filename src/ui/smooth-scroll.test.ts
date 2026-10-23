// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSmoothScroll, keyDirection, type SmoothScroll } from './smooth-scroll';

/** A div that scrolls vertically (jsdom has no layout: the sizes are stubbed). */
function scroller(scrollHeight: number, clientHeight: number, scrollTop = 0): HTMLElement {
  const el = document.createElement('div');
  el.tabIndex = 0;
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight });
  el.scrollTop = scrollTop;
  document.body.append(el);
  return el;
}

function press(target: Element, key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

describe('keyDirection', () => {
  it('maps the scrolling keys to a direction', () => {
    expect(keyDirection('ArrowDown')).toBe(1);
    expect(keyDirection('PageDown')).toBe(1);
    expect(keyDirection('End')).toBe(1);
    expect(keyDirection(' ')).toBe(1);
    expect(keyDirection(' ', true)).toBe(-1);
    expect(keyDirection('ArrowUp')).toBe(-1);
    expect(keyDirection('Home')).toBe(-1);
    expect(keyDirection('Tab')).toBe(0);
  });
});

describe('smooth scroll keys', () => {
  let s: SmoothScroll | null = null;
  afterEach(() => {
    s?.dispose();
    s = null;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function setup(): void {
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 3000, configurable: true });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    s = createSmoothScroll({ reducedMotion: true });
  }

  it('a focused inner scroller that can move keeps its keys (the page does not scroll)', () => {
    setup();
    const el = scroller(800, 300, 0);
    expect(press(el, 'End').defaultPrevented).toBe(false);
    expect(press(el, 'ArrowDown').defaultPrevented).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('at its end, or on the page itself, the keys scroll the page', () => {
    setup();
    const el = scroller(800, 300, 500);
    expect(press(el, 'End').defaultPrevented).toBe(true);
    expect(press(document.body, 'PageDown').defaultPrevented).toBe(true);
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
