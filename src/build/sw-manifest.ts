/**
 * The service worker's precache manifest (ADR 0229).
 *
 * BUILD-TIME ONLY (Node): imported by `vite.config.ts`, whose `swManifest` plugin writes the
 * result into `dist/sw.js` in place of the two placeholder lines of `public/sw.js`. App code never
 * imports this module. The dev server serves `public/sw.js` as it is: an empty list, version 'dev'.
 *
 * Pure: a description of the bundle in, `{ urls, version, bytes }` out.
 * - **What is listed:** every file the main entry (`index.html`) reaches, following what the
 *   bundler says a file loads (imports, dynamic imports, CSS, assets) and every bundle file whose
 *   name appears in an HTML, JS or CSS file's text (modulepreloads, worker URLs, `url()` in CSS,
 *   the preload helper's dependency lists). `studio.html` is never reached from it.
 * - **What is left out:** sourcemaps, `.woff` fallbacks, woff2 fonts outside the `latin` and
 *   `latin-ext` subsets (cyrillic, vietnamese), `sw.js` itself and anything named `studio*`.
 *   A left-out file is not followed further.
 * - **URLs** carry the base (`/Ssprout/`). The entry HTML is listed as the base itself, the URL a
 *   visitor navigates to.
 * - **Version:** the first 12 hex digits of a SHA-256 over the sorted URLs and the entry HTML's
 *   text. Every other listed file has a content hash in its name, so the version changes exactly
 *   when a listed file's name changes or the HTML does.
 */
import { createHash } from 'node:crypto';

/** One output file, as the plugin describes it. */
export interface BundleFile {
  /** Path relative to the output directory, e.g. `assets/main-abc.js` or `index.html`. */
  readonly fileName: string;
  /** Size in bytes. */
  readonly size: number;
  /** The text of an HTML, JS or CSS file, scanned for the names of other bundle files. */
  readonly text?: string;
  /** Files the bundler says this one loads (imports, dynamic imports, CSS, assets). */
  readonly links?: readonly string[];
}

export interface PrecacheManifest {
  /** Absolute paths under the base, the entry HTML first, then sorted. */
  readonly urls: readonly string[];
  /** Changes when, and only when, a listed name or the entry HTML changes. */
  readonly version: string;
  /** Total size of the listed files. */
  readonly bytes: number;
}

export interface ManifestOptions {
  /** The site's base path, e.g. `/Ssprout/`. */
  readonly base: string;
  /** The entry HTML (default `index.html`). */
  readonly entry?: string;
}

const basename = (fileName: string): string => fileName.slice(fileName.lastIndexOf('/') + 1);

/** Whether a reached file belongs in the precache list. */
export function isPrecached(fileName: string): boolean {
  const name = basename(fileName);
  if (name.endsWith('.map')) return false;
  if (name === 'sw.js') return false;
  if (/^studio[-.]/.test(name)) return false;
  if (name.endsWith('.woff')) return false;
  if (name.endsWith('.woff2')) return /-latin(-ext)?-\d{3}-/.test(name);
  return true;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The bundle files whose names appear in `text` (not preceded by another name character). */
function referencedIn(text: string, files: ReadonlyMap<string, BundleFile>): string[] {
  const found: string[] = [];
  for (const fileName of files.keys()) {
    const re = new RegExp(`(^|[^A-Za-z0-9_.-])${escapeRe(basename(fileName))}`);
    if (re.test(text)) found.push(fileName);
  }
  return found;
}

/** The precache manifest for the files the entry HTML reaches. */
export function buildPrecacheManifest(bundle: readonly BundleFile[], opts: ManifestOptions): PrecacheManifest {
  const base = opts.base.endsWith('/') ? opts.base : `${opts.base}/`;
  const entry = opts.entry ?? 'index.html';
  const files = new Map(bundle.map((f) => [f.fileName, f]));
  const html = files.get(entry);
  if (!html) throw new Error(`sw manifest: no ${entry} in the bundle`);

  const reached = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = files.get(queue.shift()!)!;
    const next = [...(file.links ?? []), ...(file.text === undefined ? [] : referencedIn(file.text, files))];
    for (const fileName of next) {
      if (reached.has(fileName) || !files.has(fileName) || !isPrecached(fileName)) continue;
      reached.add(fileName);
      queue.push(fileName);
    }
  }

  reached.delete(entry);
  const assets = [...reached].sort();
  const urls = [base, ...assets.map((f) => base + f)];
  const bytes = html.size + assets.reduce((sum, f) => sum + files.get(f)!.size, 0);
  const version = createHash('sha256')
    .update(JSON.stringify(urls))
    .update('\0')
    .update(html.text ?? '')
    .digest('hex')
    .slice(0, 12);
  return { urls, version, bytes };
}

/** The placeholder lines in `public/sw.js` that the build replaces. */
export const PRECACHE_PLACEHOLDER = 'self.__PRECACHE__ = [];';
export const VERSION_PLACEHOLDER = "self.__SW_VERSION__ = 'dev';";

/** `sw.js` with the manifest written in place of its placeholders; throws if one is missing. */
export function injectPrecache(swSource: string, manifest: PrecacheManifest): string {
  for (const p of [PRECACHE_PLACEHOLDER, VERSION_PLACEHOLDER]) {
    if (!swSource.includes(p)) throw new Error(`sw manifest: placeholder \`${p}\` not found in sw.js`);
  }
  return swSource
    .replace(PRECACHE_PLACEHOLDER, () => `self.__PRECACHE__ = ${JSON.stringify(manifest.urls)};`)
    .replace(VERSION_PLACEHOLDER, () => `self.__SW_VERSION__ = ${JSON.stringify(manifest.version)};`);
}

/** The structural shape of a Rollup/Rolldown output file that `describeBundle` reads. */
export interface OutputFileLike {
  readonly type: 'chunk' | 'asset';
  readonly fileName: string;
  readonly code?: string;
  readonly source?: string | Uint8Array;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly viteMetadata?: { importedCss?: Iterable<string>; importedAssets?: Iterable<string> };
}

const TEXT = /\.(html|js|mjs|css)$/;

/** Describes a Vite output bundle for `buildPrecacheManifest`. */
export function describeBundle(bundle: Record<string, OutputFileLike>): BundleFile[] {
  return Object.values(bundle).map((f) => {
    if (f.type === 'chunk') {
      const code = f.code ?? '';
      return {
        fileName: f.fileName,
        size: Buffer.byteLength(code),
        text: code,
        links: [
          ...(f.imports ?? []),
          ...(f.dynamicImports ?? []),
          ...(f.viteMetadata?.importedCss ?? []),
          ...(f.viteMetadata?.importedAssets ?? []),
        ],
      };
    }
    const source = f.source ?? '';
    const text = typeof source === 'string' ? source : TEXT.test(f.fileName) ? Buffer.from(source).toString('utf8') : undefined;
    return { fileName: f.fileName, size: typeof source === 'string' ? Buffer.byteLength(source) : source.byteLength, text };
  });
}
