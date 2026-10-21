/**
 * Capture screenshots for visual review into artifacts/shots/ (gitignored).
 *
 *   npm run shots                                   garden at all viewports
 *   npm run shots -- --name rain --query "weather=rain"
 *   npm run shots -- --eval "await sprout.addPlants(20)" --name full
 *   npm run shots -- --viewports 390x844             only some viewports (or: desktop,hd,mobile)
 *   npm run shots -- --studio                        the whole studio (full page)
 *   npm run shots -- --studio species-white-clover
 *   npm run shots -- --entry scene/full
 *   npm run shots -- --url http://localhost:5173/Ssprout/   use a running server
 *
 * Without --url a Vite dev server is started on a free port and stopped afterwards.
 * The garden is opened with ?dev, waits for window.sprout.ready(), runs --eval, then freeze().
 * Studio captures pause animation at --t seconds (default 1) for stable images.
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

const root = resolve(import.meta.dirname, '..');

const NAMED: Record<string, string> = { desktop: '1440x900', hd: '1920x1080', mobile: '390x844' };
const DEFAULT_VIEWPORTS = ['desktop', 'hd', 'mobile'];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    query: { type: 'string', default: '' },
    eval: { type: 'string' },
    viewports: { type: 'string' },
    url: { type: 'string' },
    out: { type: 'string', default: 'artifacts/shots' },
    studio: { type: 'boolean', default: false },
    entry: { type: 'string' },
    seed: { type: 'string' },
    t: { type: 'string', default: '1' },
    full: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log('See the header of scripts/shots.ts for usage.');
  process.exit(0);
}

const studioMode = values.studio || values.entry !== undefined;
const section = values.studio ? positionals[0] : undefined;

function parseViewport(spec: string): { label: string; width: number; height: number } {
  const size = NAMED[spec] ?? spec;
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) throw new Error(`bad viewport "${spec}" (use WxH or ${Object.keys(NAMED).join('/')})`);
  return { label: size, width: Number(m[1]), height: Number(m[2]) };
}

const viewports = (values.viewports?.split(',') ?? (studioMode ? ['desktop'] : DEFAULT_VIEWPORTS))
  .map((v) => v.trim())
  .filter(Boolean)
  .map(parseViewport);

const name =
  values.name ??
  (values.entry
    ? `entry-${values.entry.replace(/[^a-z0-9-]+/gi, '_')}`
    : values.studio
      ? `studio${section ? `-${section}` : ''}`
      : 'garden');

function pageUrl(base: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  const q = new URLSearchParams(values.query);
  if (studioMode) {
    if (values.entry) q.set('entry', values.entry);
    if (values.seed) q.set('seed', values.seed);
    q.set('t', values.t);
    const qs = q.toString();
    return `${b}studio.html${qs ? `?${qs}` : ''}${section ? `#${section}` : ''}`;
  }
  if (values.seed) q.set('seed', values.seed);
  const qs = q.toString();
  return `${b}?dev${qs ? `&${qs}` : ''}`;
}

async function prepareGarden(page: Page) {
  await page.waitForFunction(() => window.sprout !== undefined, null, { timeout: 30_000 });
  await page.evaluate(() => window.sprout!.ready());
  if (values.eval) {
    await page.evaluate(`(async () => { const sprout = window.sprout; ${values.eval}; })()`);
  }
  await page.evaluate(() => window.sprout!.freeze());
}

async function prepareStudio(page: Page) {
  await page.waitForFunction(() => window.studio?.ready === true, null, { timeout: 30_000 });
  if (values.eval) await page.evaluate(`(async () => { ${values.eval}; })()`);
  await page.evaluate((t) => {
    window.studio!.pause();
    window.studio!.setT(t);
  }, Number(values.t));
  const errs = await page.evaluate(() => window.studio!.errors);
  if (errs.length) console.warn('studio entry errors:\n  ' + errs.join('\n  '));
}

async function main() {
  let server: ViteDevServer | null = null;
  let base = values.url;
  if (!base) {
    server = await createServer({
      root,
      configFile: resolve(root, 'vite.config.ts'),
      logLevel: 'error',
      server: { port: 5199, strictPort: false, host: '127.0.0.1' },
    });
    await server.listen();
    base = server.resolvedUrls?.local[0];
    if (!base) throw new Error('could not resolve dev server url');
  }

  const outDir = resolve(root, values.out);
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const failures: string[] = [];
  try {
    for (const vp of viewports) {
      const mobile = vp.width < 600;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile,
      });
      const page = await context.newPage();
      page.on('console', (m) => m.type() === 'error' && failures.push(`[${vp.label}] ${m.text()}`));
      page.on('pageerror', (e) => failures.push(`[${vp.label}] ${e.message}`));
      const url = pageUrl(base);
      await page.goto(url);
      await (studioMode ? prepareStudio(page) : prepareGarden(page));
      const file = resolve(outDir, `${name}-${vp.label}.png`);
      await page.screenshot({ path: file, fullPage: values.full || (studioMode && !values.entry) });
      console.log(`saved ${file}  (${url})`);
      await context.close();
    }
  } finally {
    await browser.close();
    await server?.close();
  }
  if (failures.length) {
    console.error('page errors:\n  ' + failures.join('\n  '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
