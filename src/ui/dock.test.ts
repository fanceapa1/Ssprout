// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createDock, orderSections } from './dock';

const ids = (dock: ReturnType<typeof createDock>) => [...dock.el.querySelectorAll<HTMLElement>('section.dock-section')].map((s) => s.dataset.section);

describe('dock registry', () => {
  it('orders sections by order, then registration, in the page and in sections()', () => {
    const dock = createDock();
    dock.addSection({ id: 'tools', title: 'Garden tools', order: 90, mount: () => {} });
    dock.addSection({ id: 'session', title: 'Study', order: 10, mount: () => {} });
    dock.addSection({ id: 'plant', title: 'Your plant', order: 20, mount: () => {} });
    dock.addSection({ id: 'later', title: 'Later', mount: () => {} }); // default order 100
    dock.addSection({ id: 'also-twenty', title: 'Also 20', order: 20, mount: () => {} });
    expect(ids(dock)).toEqual(['session', 'plant', 'also-twenty', 'tools', 'later']);
    expect(dock.sections().map((s) => s.id)).toEqual(['session', 'plant', 'also-twenty', 'tools', 'later']);
  });

  it('mounts content into the body and labels the section with its heading', () => {
    const dock = createDock();
    const s = dock.addSection({ id: 'plant', title: 'Your plant', span: 'half', mount: (body) => void body.append('a painted plant') });
    expect(s.body.textContent).toBe('a painted plant');
    expect(s.el.getAttribute('aria-labelledby')).toBe('dock-plant');
    expect(s.heading.id).toBe('dock-plant');
    expect(s.heading.textContent).toBe('Your plant');
    expect(s.heading.tabIndex).toBe(-1);
    expect(s.el.dataset.span).toBe('half');
    expect(s.el.hidden).toBe(false);
    s.setTitle('Your iris');
    expect(dock.sections()[0]).toMatchObject({ id: 'plant', title: 'Your iris', filled: true, visible: true, span: 'half' });
  });

  it('gives every section a helper line under its heading that describes it (ADR 0201)', () => {
    const dock = createDock();
    const s = dock.addSection({ id: 'session', title: 'Study', helper: 'Name a task, choose a plant.', mount: () => {} });
    const head = s.el.querySelector('header.dock-head')!;
    expect([...head.children]).toEqual([s.heading, s.helper]);
    expect(s.helper.textContent).toBe('Name a task, choose a plant.');
    expect(s.el.getAttribute('aria-describedby')).toBe(s.helper.id);
    expect(dock.sections()[0]!.helper).toBe('Name a task, choose a plant.');
    s.setHelper('Pause whenever you need to.');
    expect(s.helper.textContent).toBe('Pause whenever you need to.');
    s.setHelper(null);
    expect(s.helper.hidden).toBe(true);
    expect(s.el.hasAttribute('aria-describedby')).toBe(false);
    expect(dock.sections()[0]!.helper).toBeNull();
    const bare = dock.addSection({ id: 'tools', title: 'Garden tools', mount: () => {} });
    expect(bare.helper.hidden).toBe(true);
  });

  it('keeps a placeholder hidden until it is filled', () => {
    const dock = createDock();
    const cal = dock.addSection({ id: 'calendar', title: 'Calendar', order: 30, span: 'full' });
    expect(cal.el.hidden).toBe(true);
    expect(dock.sections()[0]).toMatchObject({ id: 'calendar', filled: false, visible: false, span: 'full' });
    dock.fill('calendar', (body) => void body.append('day view'));
    expect(cal.el.hidden).toBe(false);
    expect(cal.body.textContent).toBe('day view');
    expect(() => dock.fill('nope', () => {})).toThrow(/no section/);
  });

  it('rejects duplicate and malformed ids', () => {
    const dock = createDock();
    dock.addSection({ id: 'session', title: 'Study', mount: () => {} });
    expect(() => dock.addSection({ id: 'session', title: 'Again' })).toThrow(/already exists/);
    expect(() => dock.addSection({ id: 'Has Space', title: 'x' })).toThrow(/kebab-case/);
  });

  it('runs cleanups on remove and on refill, and notifies listeners', () => {
    const dock = createDock();
    const first = vi.fn();
    const second = vi.fn();
    const changed = vi.fn();
    const off = dock.onChange(changed);
    dock.addSection({ id: 'a', title: 'A', mount: () => first });
    dock.fill('a', () => second);
    expect(first).toHaveBeenCalledTimes(1);
    dock.get('a')!.setHidden(true);
    expect(dock.sections()[0]!.visible).toBe(false);
    dock.removeSection('a');
    expect(second).toHaveBeenCalledTimes(1);
    expect(dock.get('a')).toBeNull();
    expect(ids(dock)).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(4); // add, fill, hide, remove
    off();
    dock.addSection({ id: 'b', title: 'B' });
    expect(changed).toHaveBeenCalledTimes(4);
  });

  it('orderSections is a stable sort by order then index', () => {
    const list = [
      { id: 'x', order: 5, index: 2 },
      { id: 'y', order: 1, index: 3 },
      { id: 'z', order: 5, index: 0 },
    ];
    expect(orderSections(list).map((s) => s.id)).toEqual(['y', 'z', 'x']);
    expect(list.map((s) => s.id)).toEqual(['x', 'y', 'z']); // not mutated
  });
});
