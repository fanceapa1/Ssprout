import { afterEach, describe, expect, it, vi } from 'vitest';
import { paperUrl } from './page-paper';

describe('page paper url', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hands the tile over as a short blob URL holding the PNG bytes', () => {
    let blob: Blob | null = null;
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: (b: Blob) => ((blob = b), 'blob:paper') }));
    const bytes = [137, 80, 78, 71, 0, 255];
    const url = paperUrl(`data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`);
    expect(url).toBe('blob:paper');
    expect(blob!.type).toBe('image/png');
    expect(blob!.size).toBe(bytes.length);
  });

  it('keeps the data URL where blob URLs are missing', () => {
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: undefined }));
    expect(paperUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
});
