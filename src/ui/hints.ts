import { allTips } from '../core/tips';
import type { UIContext } from './context';
import { clear, fragment, h } from './dom';
import { ICONS } from './icons';
import { createSheet, type Sheet } from './sheet';

/** The ⓘ list: every hint, including the ones already learned (retired). */
export function createHints(ctx: UIContext): Sheet {
  const { store } = ctx.deps;
  const list = h('ul.hint-list', { role: 'list' });
  const sheet = createSheet(ctx, {
    name: 'hints',
    title: 'Hints',
    subtitle: h('p.sheet-sub', {}, 'Little notes about the garden. They fade once you’ve found your way.'),
    onOpen: () => fill(),
  });
  sheet.body.append(list);

  function fill(): void {
    clear(list);
    for (const t of allTips(store.get())) {
      list.appendChild(
        h(
          'li.hint',
          { 'data-tip-id': t.id, 'data-retired': String(t.retired) },
          h('span.hint-copy', {}, t.copy),
          t.retired ? h('span.hint-state', {}, fragment(ICONS.tick), h('span', {}, 'learned')) : h('span.hint-state', {}, ''),
        ),
      );
    }
  }

  return sheet;
}
