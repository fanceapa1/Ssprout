// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createBackdrop } from './backdrop';
import { createDock } from './dock';

/** jsdom has no layout: give the host a size by hand. */
function sized(el: HTMLElement, w: number, h: number): void {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => w });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => h });
}

describe('backdrop', () => {
  it('draws once per size: not again for the same size, again when the section grows, never at zero', () => {
    const host = document.createElement('section');
    document.body.append(host);
    const b = createBackdrop(host, { seed: 'session' });
    expect(host.firstElementChild).toBe(b.el);
    expect(b.el.getAttribute('aria-hidden')).toBe('true');
    expect(b.el.querySelectorAll('.backdrop-shadow, .backdrop-leaf')).toHaveLength(2);
    sized(host, 0, 0);
    b.layout();
    expect(b.paints()).toBe(0);
    expect(b.el.dataset.paints).toBeUndefined();
    sized(host, 800, 420);
    b.layout();
    b.layout();
    expect(b.paints()).toBe(1);
    expect(b.el.dataset.size).toBe('800x420');
    expect(b.el.style.getPropertyValue('--sheet-mask')).toContain('data:image/svg+xml');
    expect(b.el.style.getPropertyValue('--sheet-shadow')).toContain('data:image/svg+xml');
    sized(host, 800, 560);
    b.layout();
    expect(b.paints()).toBe(2);
    expect(b.el.dataset.size).toBe('800x560');
    b.dispose();
    expect(host.querySelector('.backdrop')).toBeNull();
  });

  it('seeds the paper offset and the lift by strength', () => {
    const a = createBackdrop(document.createElement('div'), { seed: 'plant' });
    const c = createBackdrop(document.createElement('div'), { seed: 'calendar', strength: 'firm' });
    expect(a.el.dataset.strength).toBe('leaf');
    expect(c.el.dataset.strength).toBe('firm');
    expect(Number(c.el.style.getPropertyValue('--sheet-lift'))).toBeGreaterThan(Number(a.el.style.getPropertyValue('--sheet-lift')));
    expect(a.el.style.getPropertyValue('--sheet-grain')).not.toBe(c.el.style.getPropertyValue('--sheet-grain'));
  });

  it('every dock section gets one by default, behind its heading; `firm` and `none` are honoured', () => {
    const dock = createDock();
    const s = dock.addSection({ id: 'session', title: 'Study', mount: () => {} });
    const cal = dock.addSection({ id: 'calendar', title: 'Calendar', backdrop: 'firm', mount: () => {} });
    const bare = dock.addSection({ id: 'bare', title: 'Bare', backdrop: 'none', mount: () => {} });
    expect(s.el.firstElementChild?.classList.contains('backdrop')).toBe(true);
    expect(s.backdrop?.strength).toBe('leaf');
    expect(cal.backdrop?.strength).toBe('firm');
    expect(bare.backdrop).toBeNull();
    expect(bare.el.querySelector('.backdrop')).toBeNull();
    // the heading block still follows it, then the body
    expect([...s.el.children].map((c) => c.tagName.toLowerCase())).toEqual(['div', 'header', 'div']);
    dock.removeSection('session');
    expect(s.el.querySelector('.backdrop')).toBeNull();
  });
});
