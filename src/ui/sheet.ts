import type { UIContext } from './context';
import { fragment, h } from './dom';
import { ICONS } from './icons';

/**
 * A modal washi sheet (<dialog>) with a title and a close button — the shell for the
 * herbarium, garden data and hints views.
 */
export interface Sheet {
  readonly el: HTMLDialogElement;
  readonly body: HTMLElement;
  open(opener?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
}

export function createSheet(ctx: UIContext, opts: { name: string; title: string; subtitle?: HTMLElement; className?: string; onOpen?(): void }): Sheet {
  const titleId = `${opts.name}-title`;
  const body = h('div.sheet-body');
  const closeBtn = h(
    'button.icon-btn.sheet-close',
    { type: 'button', 'aria-label': 'Close', onclick: () => ctx.closeDialog(el) },
    fragment(ICONS.close),
  );
  const el = h(
    `dialog.sheet.sheet-${opts.name}`,
    { 'aria-labelledby': titleId, 'data-dialog': opts.name, class: opts.className },
    h(
      'div.sheet-inner',
      {},
      h('header.sheet-head', {}, h('h2.title', { id: titleId, tabindex: -1 }, opts.title), opts.subtitle ?? null, closeBtn),
      body,
    ),
  );
  // a click on the backdrop (outside the inner sheet) closes it
  el.addEventListener('click', (e) => {
    if (e.target === el) ctx.closeDialog(el);
  });
  const stickyParts = measureStickyParts(el.firstElementChild as HTMLElement);
  return {
    el,
    body,
    open(opener) {
      opts.onOpen?.();
      stickyParts.watch();
      ctx.openDialog(el, opener);
      el.querySelector<HTMLElement>('.title')?.focus({ preventScroll: true });
    },
    close: () => ctx.closeDialog(el),
    isOpen: () => el.open,
  };
}

/**
 * Keyboard focus must never leave a control under a sheet's sticky parts (Q14). The scroll
 * container's `scroll-padding` (ui.css) reads `--sheet-foot-h` / `--sheet-head-h`, kept here at the
 * height of a sticky `.sheet-foot` / `.sheet-head-sticky`, which grow when their text wraps. Each
 * sheet adds its parts after the shell is built, so they are looked up when the sheet opens.
 */
function measureStickyParts(inner: HTMLElement): { watch(): void } {
  if (typeof ResizeObserver === 'undefined') return { watch() {} };
  const parts = [
    { selector: '.sheet-foot', prop: '--sheet-foot-h' },
    { selector: '.sheet-head-sticky', prop: '--sheet-head-h' },
  ];
  const props = new Map<Element, string>();
  const observer = new ResizeObserver((entries) => {
    for (const e of entries) {
      const prop = props.get(e.target);
      const size = e.borderBoxSize?.[0]?.blockSize ?? e.target.getBoundingClientRect().height;
      if (prop) inner.style.setProperty(prop, `${Math.ceil(size)}px`);
    }
  });
  return {
    watch() {
      for (const { selector, prop } of parts) {
        const part = inner.querySelector(selector);
        if (!part || props.has(part)) continue;
        props.set(part, prop);
        observer.observe(part, { box: 'border-box' });
      }
    },
  };
}
