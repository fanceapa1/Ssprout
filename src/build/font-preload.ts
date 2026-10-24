/**
 * Font preloads for the built `index.html` (ADR 0231, docs/systems/ui.md › Fonts).
 *
 * BUILD-TIME ONLY (Node): imported by `vite.config.ts`, whose `fontPreload` plugin adds the links
 * to the production HTML. App code never imports this module, and the dev server adds nothing.
 *
 * The first view uses exactly three faces (ADR 0239), all in `src/ui/fonts.css`. Without a preload
 * the browser finds them only once the JS has built the dock, so text shows in the fallback serif
 * and then reflows. A preload starts them with the HTML's own requests.
 *
 * Pure: the bundle's assets in, the hrefs out. An asset is found by its original file name (the
 * fontsource file), so the hashed name is never written down. A missing file throws: a renamed or
 * dropped face must fail the build, not quietly drop its preload.
 */

/** The fontsource files the first view uses: Shippori Mincho 500, Cormorant Garamond 500 and 500 italic, latin. */
export const FIRST_VIEW_FONTS = [
  'shippori-mincho-latin-500-normal.woff2',
  'cormorant-garamond-latin-500-normal.woff2',
  'cormorant-garamond-latin-500-italic.woff2',
] as const;

/** One output asset, as the plugin describes it. */
export interface AssetLike {
  readonly fileName: string;
  /** The names the asset was emitted under (the source file's base name). */
  readonly names?: readonly string[];
  /** Absolute paths of the source files. */
  readonly originalFileNames?: readonly string[];
}

const basename = (path: string): string => path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);

function sourceNames(asset: AssetLike): string[] {
  return [...(asset.names ?? []), ...(asset.originalFileNames ?? [])].map(basename);
}

/** The URL of each font in `fonts`, in that order, under `base` (e.g. `/Ssprout/`). */
export function fontPreloadHrefs(
  assets: readonly AssetLike[],
  base: string,
  fonts: readonly string[] = FIRST_VIEW_FONTS,
): string[] {
  return fonts.map((font) => {
    const asset = assets.find((a) => sourceNames(a).includes(font));
    if (!asset) throw new Error(`font preload: ${font} is not in the bundle (src/ui/fonts.css, ADR 0231)`);
    return base + asset.fileName;
  });
}
