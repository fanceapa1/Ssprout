import { copySoundscape, defaultSoundscape, SCENERIES, sceneryMix, selectedMix, silentLevels, SOUND_LAYERS, SOUND_PRESETS, STANDARD_LAYERS, type SoundLayer, type SoundLevels } from '../core/soundscape';
import type { UIContext } from './context';
import { fragment, h, setText } from './dom';
import { ICONS, type IconName } from './icons';
import { createSheet } from './sheet';

const SOUNDS: Record<SoundLayer, { name: string; note: string; icon: IconName }> = {
  water: { name: 'Pond water', note: 'Small ripples against the stones.', icon: 'drops' },
  wind: { name: 'Wind in the leaves', note: 'A slow breath through the trees.', icon: 'wind' },
  birds: { name: 'Distant birds', note: 'A little song, now and then.', icon: 'bird' },
  crickets: { name: 'Crickets', note: 'Soft trills from the grass.', icon: 'cricket' },
  rain: { name: 'Soft rain', note: 'A steady patter, close by.', icon: 'drops' },
  waves: { name: 'Ocean waves', note: 'The shore breathing in and out.', icon: 'waves' },
  fire: { name: 'Fireplace', note: 'A low rustle and gentle crackle.', icon: 'fire' },
  cafe: { name: 'Café', note: 'A room murmur, a cup set down.', icon: 'coffee' },
  lofi: { name: 'Lo-fi', note: 'Warm keys and a slow, soft beat.', icon: 'music' },
  white: { name: 'White noise', note: 'An even veil of sound.', icon: 'noise' },
  brown: { name: 'Brown noise', note: 'A deeper, softer hush.', icon: 'noise' },
};

/** Two collections share playback, but never overwrite each other's remembered mix. */
export function createSoundMixer(ctx: UIContext) {
  const { store, controller, audio } = ctx.deps;
  const settings = () => copySoundscape(store.get().settings.soundscape ?? defaultSoundscape());
  const scenery = () => audio?.getScenery?.() ?? 'pond';
  const sheet = createSheet(ctx, {
    name: 'soundscape', title: 'Your soundscape',
    subtitle: h('p.sheet-sub', {}, 'Familiar sounds, or a little company from this place.'),
    onOpen: () => render(),
  });
  function save(next: ReturnType<typeof settings>): void {
    controller.updateSettings({ soundscape: next });
    render();
  }
  function setLevels(levels: SoundLevels): void {
    const next = settings();
    if (next.collection === 'standard') next.standard = { ...levels };
    else next.sceneries[scenery()] = { mode: 'custom', levels: { ...levels } };
    save(next);
  }
  const collections = h('div.sound-collections', { role: 'group', 'aria-label': 'Sound collection' });
  const collectionButtons = (['standard', 'scenery'] as const).map((id) => {
    const b = h('button.quiet', { type: 'button', 'data-collection': id }, id === 'standard' ? 'Standard sounds' : 'Scenery sounds');
    b.addEventListener('click', () => { const s = settings(); s.collection = id; save(s); });
    collections.append(b);
    return b;
  });
  const place = h('h3.sound-place');
  const description = h('p.sound-description');
  const follow = h('button.quiet', { type: 'button', 'aria-pressed': 'true' }, 'Follow the garden');
  follow.addEventListener('click', () => {
    const next = settings();
    const current = sceneryMix(next, scenery());
    next.sceneries[scenery()] = { ...current, mode: current.mode === 'garden' ? 'custom' : 'garden' };
    save(next);
  });
  const presets = h('div.sound-presets', { role: 'group', 'aria-label': 'Starting mixes' });
  const presetButtons = SOUND_PRESETS.map((p) => {
    const b = h('button.quiet', { type: 'button' }, p.name);
    b.addEventListener('click', () => setLevels(p.levels));
    presets.append(b);
    return { preset: p, button: b };
  });
  const rows = h('div.sound-layers');
  let paletteKey = '';
  const remembered = new Map<string, number>();
  const controls = SOUND_LAYERS.map((id) => {
    const def = SOUNDS[id], inputId = `sound-level-${id}`;
    const toggle = h('button.quiet.sound-toggle', { type: 'button', 'aria-label': def.name, 'aria-pressed': 'false' },
      fragment(ICONS[def.icon]), h('span', {}, def.name));
    const output = h('output.sound-level', { for: inputId, 'aria-hidden': 'true' });
    const input = h('input.duration.sound-range', { id: inputId, type: 'range', min: 0, max: 100, step: 1, 'aria-label': `${def.name} volume` });
    const row = h('div.sound-layer', { 'data-sound': id },
      h('div.sound-layer-head', {}, toggle, output), h('p.sound-note', {}, def.note), input);
    input.addEventListener('input', () => {
      const levels = { ...selectedMix(settings(), scenery()).levels, [id]: Number(input.value) };
      setLevels(levels);
    });
    toggle.addEventListener('click', () => {
      const s = settings(), levels = { ...selectedMix(s, scenery()).levels };
      const key = `${s.collection}:${s.collection === 'scenery' ? scenery() : ''}:${id}`;
      if (levels[id] > 0) { remembered.set(key, levels[id]); levels[id] = 0; }
      else levels[id] = remembered.get(key) ?? 50;
      setLevels(levels);
    });
    rows.append(row);
    return { id, row, toggle, input, output };
  });
  const play = h('button.quiet.ink.sound-play', { type: 'button' });
  play.addEventListener('click', () => {
    const muted = !store.get().settings.muted;
    controller.updateSettings({ muted });
    audio?.setMuted(muted);
    audio?.unlock();
    render();
  });
  const master = h('input.duration.sound-range', { id: 'sound-master', type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Overall volume' });
  const masterOutput = h('output.sound-level', { for: 'sound-master', 'aria-hidden': 'true' });
  master.addEventListener('input', () => { const s = settings(); s.volume = Number(master.value); save(s); });
  const status = h('p.sound-status', { role: 'status', 'aria-live': 'polite' });
  const clear = h('button.quiet', { type: 'button' }, 'Clear this mix');
  clear.addEventListener('click', () => setLevels(silentLevels()));
  const footer = h('footer.sound-footer.sheet-foot', {},
    h('div.sound-playback', {}, play),
    h('div.sound-master', {}, h('div.sound-layer-head', {}, h('label', { for: 'sound-master' }, 'Overall volume'), masterOutput), master));
  sheet.body.append(collections, h('div.sound-context', {}, h('div', {}, place, description), follow), presets, status, rows,
    h('div.sound-footnote', {}, h('span', {}, 'Changes are saved as you go.'), clear), footer);

  function render(): void {
    const s = settings(), id = scenery(), isScenery = s.collection === 'scenery';
    const mix = selectedMix(s, id), automatic = isScenery && mix.mode === 'garden';
    sheet.el.dataset.collection = s.collection;
    for (const b of collectionButtons) b.setAttribute('aria-pressed', String(b.dataset.collection === s.collection));
    setText(place, isScenery ? SCENERIES[id].name : 'Familiar places, wherever you are');
    setText(description, isScenery ? (automatic ? 'Sounds follow the weather and time of day. Adjust one to make your own mix.' : 'Your mix for this garden, kept for your return.') : 'Mix your favourites. They stay with you in every scenery.');
    follow.hidden = !isScenery;
    follow.setAttribute('aria-pressed', String(automatic));
    presets.hidden = !isScenery;
    for (const { preset, button } of presetButtons) {
      button.hidden = preset.scenery !== id;
      button.setAttribute('aria-pressed', String(!automatic && SOUND_LAYERS.every((key) => mix.levels[key] === preset.levels[key])));
    }
    const visibleLayers: readonly SoundLayer[] = isScenery ? SCENERIES[id].layers : STANDARD_LAYERS;
    if (paletteKey !== `${s.collection}:${id}`) {
      paletteKey = `${s.collection}:${id}`;
      // DOM, reading and keyboard order all follow the visible palette. Do not move nodes on edits.
      const ordered = [...visibleLayers, ...SOUND_LAYERS.filter((key) => !visibleLayers.includes(key))];
      rows.replaceChildren(...ordered.map((key) => controls.find((c) => c.id === key)!.row));
    }
    for (const c of controls) {
      c.row.hidden = !visibleLayers.includes(c.id);
      c.row.dataset.automatic = String(automatic);
      c.toggle.setAttribute('aria-pressed', String(!automatic && mix.levels[c.id] > 0));
      c.input.value = String(mix.levels[c.id]);
      c.input.style.setProperty('--fill', String(mix.levels[c.id] / 100));
      c.input.setAttribute('aria-valuetext', automatic ? `${mix.levels[c.id]} percent in your own mix; currently follows the garden` : `${mix.levels[c.id]} percent`);
      setText(c.output, automatic ? 'Auto' : mix.levels[c.id] === 0 ? 'Off' : `${mix.levels[c.id]}%`);
    }
    master.value = String(s.volume);
    master.style.setProperty('--fill', String(s.volume / 100));
    setText(masterOutput, `${s.volume}%`);
    const muted = store.get().settings.muted;
    setText(play, muted ? 'Listen' : 'Mute sounds');
    play.setAttribute('aria-pressed', String(!muted));
    const empty = !automatic && SOUND_LAYERS.every((key) => mix.levels[key] === 0);
    setText(status, empty ? 'Your mix is quiet. Bring a sound up to begin.' : s.volume === 0 ? 'Overall volume is at zero.' : muted ? 'Sound is off. Your mix is ready when you are.' : 'Sound is on. Take your time.');
  }
  const offScenery = audio?.onSceneryChange?.(() => render());
  render();
  return { ...sheet, render, dispose: () => offScenery?.() };
}
