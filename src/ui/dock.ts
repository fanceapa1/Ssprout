import { createBackdrop, type Backdrop } from './backdrop';
import type { SheetStrength } from './backdrop-sheet';
import { h, setText } from './dom';

/**
 * The dock (ADR 0130): the part of the page below the garden where features live as sections.
 * A feature registers a section; the dock owns the order, the layout (two calm columns on wide
 * screens, one on phones) and the headings. Later features (calendar, session switcher, …) plug
 * in with `addSection` without touching the page. Contract: docs/ARCHITECTURE.md › Dock.
 *
 *   ui.dock.addSection({ id: 'calendar', title: 'Calendar', order: 30, span: 'full', mount(body) { … } });
 *
 * A section registered without `mount` is a placeholder: it holds its place in the order but
 * stays hidden until `fill(id, mount)` gives it content.
 */
export type DockSpan = 'half' | 'full';

export interface DockSectionDef {
  /** unique, kebab-case; also `data-section` and the heading id (`dock-<id>`) */
  id: string;
  /** the section heading */
  title: string;
  /**
   * One short line under the heading: what the section is for and what to do next (ADR 0201).
   * Change it with `setHelper` as the state moves on.
   */
  helper?: string;
  /** lower first (default 100); ties keep registration order */
  order?: number;
  /** wide screens: one column (`half`, default) or the whole row (`full`); phones: always full */
  span?: DockSpan;
  /**
   * The sheet of washi behind the section (ADR 0208): `leaf` (default), `firm` (a stronger
   * surface, the calendar) or `none`.
   */
  backdrop?: SheetStrength | 'none';
  /**
   * Build the section's content into `body`. May return a cleanup, called on `removeSection`.
   * Omit to register a hidden placeholder (see `fill`).
   */
  mount?: DockMount;
}

export type DockMount = (body: HTMLElement, section: DockSection) => void | (() => void);

export interface DockSection {
  readonly id: string;
  /** the `<section>` */
  readonly el: HTMLElement;
  /** where content goes */
  readonly body: HTMLElement;
  /** the heading (`h2`, focusable with tabindex -1 for jumps) */
  readonly heading: HTMLElement;
  /** the helper line under the heading (`p.dock-helper`, the section's description; hidden when empty) */
  readonly helper: HTMLElement;
  /** the backdrop sheet behind the section (`div.backdrop`), or null with `backdrop: 'none'` */
  readonly backdrop: Backdrop | null;
  setTitle(title: string): void;
  /** set the helper line (null or '' hides it); a no-op when unchanged */
  setHelper(text: string | null): void;
  /** hide or show the whole section (e.g. nothing to show yet) */
  setHidden(hidden: boolean): void;
}

export interface DockSectionInfo {
  id: string;
  title: string;
  /** the helper line, or null */
  helper: string | null;
  order: number;
  span: DockSpan;
  /** has content (mounted) */
  filled: boolean;
  /** shown on the page */
  visible: boolean;
}

export interface Dock {
  readonly el: HTMLElement;
  /** register a section; throws on a duplicate or malformed id */
  addSection(def: DockSectionDef): DockSection;
  /** give a placeholder its content (or replace a section's content) */
  fill(id: string, mount: DockMount): DockSection;
  removeSection(id: string): void;
  get(id: string): DockSection | null;
  /** sections in page order */
  sections(): DockSectionInfo[];
  /** called after a section is added, filled, removed or hidden */
  onChange(fn: () => void): () => void;
  dispose(): void;
}

const ID = /^[a-z][a-z0-9-]*$/;

interface Entry {
  def: Required<Pick<DockSectionDef, 'id' | 'title' | 'order' | 'span'>> & { helper: string | null };
  index: number;
  section: DockSection;
  filled: boolean;
  hidden: boolean;
  cleanup: (() => void) | null;
  backdrop: Backdrop | null;
}

/** Page order: by `order`, then registration. Pure, exported for tests. */
export function orderSections<T extends { order: number; index: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order || a.index - b.index);
}

export function createDock(opts: { label?: string } = {}): Dock {
  const el = h('div.dock', { role: 'region', 'aria-label': opts.label ?? 'Study tools', 'data-dock': '' });
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let counter = 0;

  const changed = () => {
    for (const fn of [...listeners]) fn();
  };

  const visibleOf = (e: Entry) => e.filled && !e.hidden;
  const sync = (e: Entry) => {
    e.section.el.hidden = !visibleOf(e);
    e.section.el.dataset.filled = String(e.filled);
  };

  function arrange(): void {
    for (const e of orderSections([...entries.values()].map((x) => ({ ...x, order: x.def.order })))) el.appendChild(e.section.el);
  }

  function mountInto(e: Entry, mount: DockMount): void {
    e.cleanup?.();
    e.section.body.replaceChildren();
    const out = mount(e.section.body, e.section);
    e.cleanup = typeof out === 'function' ? out : null;
    e.filled = true;
    sync(e);
  }

  const dock: Dock = {
    el,
    addSection(def) {
      if (!ID.test(def.id)) throw new Error(`dock: section id "${def.id}" must be kebab-case`);
      if (entries.has(def.id)) throw new Error(`dock: section "${def.id}" already exists`);
      const headingId = `dock-${def.id}`;
      const heading = h('h2.dock-title', { id: headingId, tabindex: -1 }, def.title);
      const helper = h('p.dock-helper', { id: `${headingId}-helper` });
      const body = h('div.dock-body');
      // the heading and its helper line: one block, the same in every section (ADR 0201)
      const head = h('header.dock-head', {}, heading, helper);
      const sectionEl = h('section.dock-section', { 'data-section': def.id, 'data-span': def.span ?? 'half', 'aria-labelledby': headingId }, head, body);
      const backdrop = def.backdrop === 'none' ? null : createBackdrop(sectionEl, { seed: def.id, strength: def.backdrop ?? 'leaf' });
      const writeHelper = (text: string | null) => {
        const t = text?.trim() || null;
        entry.def.helper = t;
        helper.textContent = t ?? '';
        helper.hidden = t === null;
        if (t) sectionEl.setAttribute('aria-describedby', helper.id);
        else sectionEl.removeAttribute('aria-describedby');
      };
      const entry: Entry = {
        def: { id: def.id, title: def.title, order: def.order ?? 100, span: def.span ?? 'half', helper: null },
        index: counter++,
        filled: false,
        hidden: false,
        cleanup: null,
        backdrop,
        section: {
          id: def.id,
          el: sectionEl,
          body,
          heading,
          helper,
          backdrop,
          setTitle(title) {
            entry.def.title = title;
            setText(heading, title);
          },
          setHelper(text) {
            if ((text?.trim() || null) !== entry.def.helper) writeHelper(text);
          },
          setHidden(hidden) {
            if (entry.hidden === hidden) return;
            entry.hidden = hidden;
            sync(entry);
            changed();
          },
        },
      };
      writeHelper(def.helper ?? null);
      entries.set(def.id, entry);
      sync(entry);
      arrange();
      if (def.mount) mountInto(entry, def.mount);
      changed();
      return entry.section;
    },
    fill(id, mount) {
      const e = entries.get(id);
      if (!e) throw new Error(`dock: no section "${id}"`);
      mountInto(e, mount);
      changed();
      return e.section;
    },
    removeSection(id) {
      const e = entries.get(id);
      if (!e) return;
      e.cleanup?.();
      e.backdrop?.dispose();
      e.section.el.remove();
      entries.delete(id);
      changed();
    },
    get: (id) => entries.get(id)?.section ?? null,
    sections: () =>
      orderSections([...entries.values()].map((x) => ({ ...x, order: x.def.order }))).map((e) => ({
        id: e.def.id,
        title: e.def.title,
        helper: e.def.helper,
        order: e.def.order,
        span: e.def.span,
        filled: e.filled,
        visible: visibleOf(e),
      })),
    onChange(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    dispose() {
      for (const e of entries.values()) {
        e.cleanup?.();
        e.backdrop?.dispose();
      }
      entries.clear();
      listeners.clear();
      el.replaceChildren();
    },
  };
  return dock;
}
