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
  return {
    el,
    body,
    open(opener) {
      opts.onOpen?.();
      ctx.openDialog(el, opener);
      el.querySelector<HTMLElement>('.title')?.focus({ preventScroll: true });
    },
    close: () => ctx.closeDialog(el),
    isOpen: () => el.open,
  };
}
