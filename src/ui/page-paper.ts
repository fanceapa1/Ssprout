import { paperTexture } from '../paint/paper';

/**
 * The page's paper (ADR 0132): the same washi as the garden's `paper` layer — `paperTexture`
 * from src/paint/paper.ts, same seed, one grain texel per CSS pixel — as a tile under the whole
 * document, so the UI below the garden sits on the paper the painting dissolves into. No second
 * tint: the tile is the washi colour with grain only (no mottle, no vignette, so it repeats
 * seamlessly) and the painting itself is never filled with it (ADR 0021).
 */
export const PAGE_PAPER_TILE = 512;

let installed = false;

/** Generate the tile and set `--page-paper` on :root. Runs once; harmless without a canvas. */
export function installPagePaper(doc: Document = document, seed = 1): boolean {
  if (installed) return true;
  try {
    const tile = paperTexture(PAGE_PAPER_TILE, PAGE_PAPER_TILE, seed, { mottle: 0, vignette: 0, grainScale: 1 });
    const out = doc.createElement('canvas');
    out.width = PAGE_PAPER_TILE;
    out.height = PAGE_PAPER_TILE;
    const ctx = out.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(tile as CanvasImageSource, 0, 0);
    const url = out.toDataURL('image/png');
    doc.documentElement.style.setProperty('--page-paper', `url("${url}")`);
    installed = true;
    return true;
  } catch {
    return false;
  }
}
