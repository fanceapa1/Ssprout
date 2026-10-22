import type { Page } from '@playwright/test';
import { expect, openDev } from './fixtures';

export const MIN = 60_000;

/**
 * Turn off the UI's CSS animations and shorten its transitions to 1 ms, exactly as the app's own
 * `prefers-reduced-motion` stylesheet does for the UI (src/ui/ui.css), without switching the
 * garden into reduced motion. `?uitime` scales the UI's JS delays, but CSS keeps its real
 * durations: the planting sheet rises for 900 ms and Playwright waits for a clicked element to stop
 * moving, which stretches to seconds on a loaded machine. Nothing in the UI listens for
 * transition/animation events, so this changes timing only. Installed as an init script, so it
 * survives reloads and also applies inside the widget iframes.
 */
export async function calmUiMotion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const css = `.ui-root *, .ui-root *::before, dialog.sheet, dialog.sheet *, dialog.sheet::backdrop {
      animation: none !important; transition-duration: 1ms !important; }`;
    const add = () => {
      const style = document.createElement('style');
      style.dataset.test = 'calm-ui-motion';
      style.textContent = css;
      document.head.append(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
}

/** Open the garden with fixture species and fast UI delays, on a fresh seeded garden. */
export async function openUi(page: Page, query = ''): Promise<void> {
  await calmUiMotion(page);
  await openDev(page, `fixtures&uitime=0.02${query ? `&${query}` : ''}`);
  await page.evaluate(() => {
    window.sprout!.reset();
    window.sprout!.seed(7);
    window.sprout!.ui.refresh();
  });
}

export async function reloadUi(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => window.sprout !== undefined);
  await page.evaluate(() => window.sprout!.ready());
}

/** Set the planting sheet's total time (the range input) to `minutes`. */
export async function setMinutes(page: Page, minutes: number): Promise<void> {
  await page.locator('dialog[data-dialog="planting"] input.duration').evaluate((el, m) => {
    const input = el as HTMLInputElement;
    input.value = String(m);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, minutes);
}

export interface PlantOptions {
  task?: string;
  minutes?: number;
  /** plan id, or its index among the recommended plans */
  plan?: string | number;
  species: string;
  /** slot id, or 'free' / 'occupied' for the first marker of that kind */
  slot?: string | 'free' | 'occupied';
  begin?: boolean;
}

/** Drive the whole start flow through the UI: sheet → plan → plant → spot → Begin. */
export async function plantSession(page: Page, o: PlantOptions): Promise<void> {
  await page.locator('.panel').getByRole('button', { name: 'Start studying' }).click();
  const sheet = page.locator('dialog[data-dialog="planting"]');
  await expect(sheet).toBeVisible();
  if (o.task !== undefined) await sheet.getByLabel('What are you studying?').fill(o.task);
  if (o.minutes !== undefined) await setMinutes(page, o.minutes);
  if (o.plan !== undefined) {
    const card = typeof o.plan === 'number' ? sheet.locator('.plan-card').nth(o.plan) : sheet.locator(`.plan-card[data-plan-id="${o.plan}"]`);
    await card.click();
  }
  await sheet.locator(`.plant-card[data-species-id="${o.species}"]`).click();
  await sheet.getByRole('button', { name: 'Choose a spot' }).click();
  await expect(sheet).toBeHidden();
  const markers = page.locator('button.marker[data-slot-id]');
  await expect(markers.first()).toBeVisible();
  const slot = o.slot ?? 'free';
  const marker =
    slot === 'free'
      ? page.locator('button.marker[data-occupied="false"]').first()
      : slot === 'occupied'
        ? page.locator('button.marker[data-occupied="true"]').first()
        : page.locator(`button.marker[data-slot-id="${slot}"]`);
  await marker.click();
  if (o.begin !== false) {
    await page.locator('.placement-bar').getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.panel')).toHaveAttribute('data-view', 'focus');
  }
}
