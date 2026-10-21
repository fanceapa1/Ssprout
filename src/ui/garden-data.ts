import { exportFileName, exportState, importState, type PersistError } from '../core/persistence';
import type { GardenState } from '../core/state';
import type { UIContext } from './context';
import { h, setText } from './dom';
import { spokenMinutes } from './format';
import { createSheet, type Sheet } from './sheet';

/**
 * Garden data: export the garden as `study-sprout-garden-YYYY-MM-DD.json`, import one back
 * (validated by core persistence; errors shown inline; the replacement is confirmed first).
 */

export function importErrorText(e: PersistError): string {
  switch (e.code) {
    case 'invalid-json':
      return 'That file could not be read as a garden — it isn’t valid JSON.';
    case 'not-a-garden':
      return 'That file doesn’t look like a Study Sprout garden.';
    case 'unsupported-version':
      return 'That garden was kept by a newer version of Study Sprout than this one.';
    case 'migration-failed':
      return 'That garden is from an older version and could not be brought up to date.';
    case 'invalid-state':
      return `That garden file is damaged${e.path ? ` (at ${e.path})` : ''}, so nothing was changed.`;
    default:
      return 'That file could not be imported.';
  }
}

export function summaryText(s: GardenState): string {
  const plants = s.plants.length;
  const parts = [
    plants === 0 ? 'no plants yet' : plants === 1 ? 'one plant growing' : `${plants} plants growing`,
    s.pressed.length === 1 ? 'one pressed flower' : `${s.pressed.length} pressed flowers`,
    `${spokenMinutes(s.stats.totalMinutes)} studied over ${s.stats.completed} session${s.stats.completed === 1 ? '' : 's'}`,
  ];
  return parts.join(' · ');
}

export function createGardenData(ctx: UIContext): Sheet {
  const { store, clock } = ctx.deps;
  const summary = h('p.sheet-sub.data-summary');
  const sheet = createSheet(ctx, { name: 'data', title: 'Garden data', subtitle: summary, onOpen: () => reset() });

  const exportBtn = h('button.quiet.ink.export', { type: 'button', onclick: () => doExport() }, 'Export garden');
  const file = h('input.visually-hidden.import-file', { type: 'file', accept: '.json,application/json', tabindex: -1, 'aria-hidden': 'true' });
  const importBtn = h('button.quiet.ink.import', { type: 'button', onclick: () => file.click() }, 'Import a garden…');
  const error = h('p.data-error', { role: 'alert' });
  const status = h('p.data-status', { role: 'status' });
  const confirmText = h('p.confirm-text');
  const keepBtn = h('button.quiet.keep-mine', { type: 'button', onclick: () => reset() }, 'Keep mine');
  const replaceBtn = h('button.seal.replace', { type: 'button', onclick: () => applyPending() }, 'Replace');
  const confirm = h('div.confirm.import-confirm', { role: 'group', hidden: true }, confirmText, h('div.actions', {}, keepBtn, replaceBtn));
  let pending: GardenState | null = null;

  sheet.body.append(
    h('section.data-row', {}, h('p', {}, 'Keep a copy of your garden as a small file — to move it to another browser, or just to be safe.'), exportBtn),
    h('section.data-row', {}, h('p', {}, 'Restore a garden from a file. It takes the place of the one growing here.'), importBtn, file),
    error,
    confirm,
    status,
  );

  function reset(): void {
    pending = null;
    confirm.hidden = true;
    setText(error, '');
    setText(status, '');
    setText(summary, summaryText(store.get()));
    file.value = '';
  }

  function doExport(): void {
    const now = clock.now();
    const blob = new Blob([exportState(store.get(), now)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: exportFileName(now) });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setText(status, `Saved as ${exportFileName(now)}.`);
  }

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    setText(error, '');
    setText(status, '');
    const r = importState(await f.text(), { isKnownSpecies: ctx.deps.isKnownSpecies, now: clock.now() });
    file.value = '';
    if (!r.ok) {
      pending = null;
      confirm.hidden = true;
      setText(error, importErrorText(r.error));
      return;
    }
    pending = r.state;
    const n = r.state.plants.length;
    const unknown = r.warnings.unknownSpecies.length;
    setText(
      confirmText,
      `Replace your garden with this one — ${n === 1 ? 'one plant' : `${n} plants`}, ${r.state.pressed.length} pressed?` +
        (unknown ? ` (${unknown} kind${unknown === 1 ? '' : 's'} of plant this version doesn’t know yet will be kept.)` : ''),
    );
    confirm.hidden = false;
    keepBtn.focus({ preventScroll: true });
  });

  function applyPending(): void {
    if (!pending) return;
    store.dispatch({ type: 'state/replace', state: pending });
    pending = null;
    confirm.hidden = true;
    setText(summary, summaryText(store.get()));
    setText(status, 'Your garden has been restored.');
    ctx.announce('Garden restored.');
    importBtn.focus({ preventScroll: true });
  }

  return sheet;
}
