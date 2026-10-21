import type { StudioEntry, StudioModule, StudioSection } from './types';

export function collectSections(modules: Record<string, StudioModule>): StudioSection[] {
  const sections: StudioSection[] = [];
  const ids = new Set<string>();
  for (const [path, mod] of Object.entries(modules)) {
    const list = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const section of list) {
      if (!section || !section.id) throw new Error(`studio module ${path} exports an invalid section`);
      if (ids.has(section.id)) throw new Error(`duplicate studio section id "${section.id}" (${path})`);
      ids.add(section.id);
      const entryIds = new Set<string>();
      for (const e of section.entries) {
        if (entryIds.has(e.id)) throw new Error(`duplicate entry id "${e.id}" in studio section "${section.id}"`);
        entryIds.add(e.id);
      }
      sections.push(section);
    }
  }
  return sections.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));
}

export const fullId = (section: StudioSection, entry: StudioEntry) => `${section.id}/${entry.id}`;

/** Find an entry by `<section>/<entry>` or, if unambiguous, by bare entry id. */
export function findEntry(
  sections: StudioSection[],
  id: string,
): { section: StudioSection; entry: StudioEntry } | undefined {
  const matches: { section: StudioSection; entry: StudioEntry }[] = [];
  for (const section of sections) {
    for (const entry of section.entries) {
      if (fullId(section, entry) === id) return { section, entry };
      if (entry.id === id) matches.push({ section, entry });
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}
