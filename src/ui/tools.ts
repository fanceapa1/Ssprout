import type { UIContext } from './context';
import { fragment, h, setText } from './dom';
import { ICONS, type IconName } from './icons';

/**
 * Garden tools (ADR 0135): sound, floating timer (only with a supported widget integration),
 * pressed flowers, garden data and hints. One implementation, two views over the same state:
 * - `corner`: ink icons on soft paper chips at the garden's top right, label on hover/focus;
 * - `dock`: the same icons with visible names and a short note, in the "Garden tools" section.
 * `render()` updates both (e.g. the mute state), so they can never disagree.
 */
export type ToolId = 'sound' | 'widget' | 'herbarium' | 'data' | 'hints';

export interface Tools {
  /** the corner view (`nav.menu`) */
  readonly corner: HTMLElement;
  /** the dock view (`ul.tool-list`) */
  readonly dock: HTMLElement;
  render(): void;
  /** the buttons for a tool, corner first */
  buttons(id: ToolId): HTMLButtonElement[];
  dispose(): void;
}

export interface ToolActions {
  openHerbarium(opener: HTMLElement): void;
  openData(opener: HTMLElement): void;
  openHints(opener: HTMLElement): void;
}

interface ToolDef {
  id: ToolId;
  /** accessible name (stable; the pressed state is aria-pressed) */
  name: string;
  icon(): IconName;
  /** the hover label in the corner */
  label(): string;
  /** the dock's short note under the name */
  note(): string;
  pressed?(): boolean;
  dialog?: boolean;
  run(button: HTMLButtonElement): void;
}

export function createTools(ctx: UIContext, actions: ToolActions): Tools {
  const { controller, store, audio, widget } = ctx.deps;
  const muted = () => store.get().settings.muted;

  const defs: ToolDef[] = [
    {
      id: 'sound',
      name: 'Garden sounds',
      icon: () => (muted() ? 'soundOff' : 'soundOn'),
      label: () => (muted() ? 'Sound off' : 'Sound on'),
      note: () => (muted() ? 'Off. Water, wind and birds, very softly.' : 'On. Water, wind and birds, very softly.'),
      pressed: () => !muted(),
      run: () => {
        const next = !muted();
        controller.updateSettings({ muted: next }); // emits settings:changed (audio follows) and retires the tip
        if (audio) {
          audio.setMuted(next);
          audio.unlock(); // inside the click: satisfies the autoplay policy
        }
      },
    },
  ];
  if (widget?.supported) {
    defs.push({
      id: 'widget',
      name: 'Floating timer',
      icon: () => 'floating',
      label: () => 'Floating timer',
      note: () => (widget.isOpen() ? 'Open beside your work.' : 'A small window with your plant, beside your work.'),
      pressed: () => widget.isOpen(),
      run: () => {
        void widget.open();
        controller.retireTip('widget');
      },
    });
  }
  defs.push(
    {
      id: 'herbarium',
      name: 'Pressed flowers',
      icon: () => 'book',
      label: () => 'Pressed flowers',
      note: () => 'Plants you replaced, kept in a book.',
      dialog: true,
      run: (b) => actions.openHerbarium(b),
    },
    {
      id: 'data',
      name: 'Garden data',
      icon: () => 'data',
      label: () => 'Garden data',
      note: () => 'Save a copy of your garden, or bring one back.',
      dialog: true,
      run: (b) => actions.openData(b),
    },
    {
      id: 'hints',
      name: 'Hints',
      icon: () => 'info',
      label: () => 'Hints',
      note: () => 'Every little note, the learned ones too.',
      dialog: true,
      run: (b) => actions.openHints(b),
    },
  );

  const all = new Map<ToolId, HTMLButtonElement[]>();
  const shownIcon = new WeakMap<HTMLButtonElement, IconName>();

  function button(def: ToolDef, view: 'corner' | 'dock'): HTMLButtonElement {
    const attrs: Record<string, unknown> = {
      type: 'button',
      'data-anchor': def.id,
      'data-tool': def.id,
      'aria-label': def.name,
    };
    if (def.dialog) attrs['aria-haspopup'] = 'dialog';
    const b =
      view === 'corner'
        ? h('button.icon-btn.menu-item', { ...attrs, 'data-menu': def.id }, h('span.icon-slot', {}), h('span.menu-label', { 'aria-hidden': 'true' }))
        : h(
            'button.tool',
            attrs,
            h('span.icon-slot', {}),
            h('span.tool-text', {}, h('span.tool-name', {}, def.name), h('span.tool-note', {})),
          );
    b.addEventListener('click', () => {
      def.run(b);
      render();
    });
    const list = all.get(def.id) ?? [];
    list.push(b);
    all.set(def.id, list);
    return b;
  }

  const corner = h('nav.menu', { 'aria-label': 'Garden menu', 'data-ui': 'menu' }, ...defs.map((d) => button(d, 'corner')));
  const dock = h('ul.tool-list', { role: 'list' }, ...defs.map((d) => h('li', {}, button(d, 'dock'))));

  function render(): void {
    for (const def of defs) {
      const icon = def.icon();
      const pressed = def.pressed?.();
      for (const b of all.get(def.id) ?? []) {
        if (shownIcon.get(b) !== icon) {
          shownIcon.set(b, icon);
          b.querySelector('.icon-slot')!.replaceChildren(fragment(ICONS[icon]));
        }
        if (pressed !== undefined && b.getAttribute('aria-pressed') !== String(pressed)) b.setAttribute('aria-pressed', String(pressed));
        const label = b.querySelector('.menu-label');
        if (label) setText(label, def.label());
        const note = b.querySelector('.tool-note');
        if (note) setText(note, def.note());
      }
    }
  }

  const offWidget = widget?.supported ? widget.onChange?.(() => render()) : undefined;
  render();

  return {
    corner,
    dock,
    render,
    buttons: (id) => [...(all.get(id) ?? [])],
    dispose() {
      offWidget?.();
    },
  };
}
