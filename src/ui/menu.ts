import type { UIContext } from './context';
import { fragment, h } from './dom';
import { ICONS, type IconName } from './icons';

/**
 * Corner menu (top right): sound, floating timer (only with a supported widget integration),
 * pressed flowers, garden data, hints. Ink icons with a small label on hover/focus.
 */
export interface Menu {
  readonly el: HTMLElement;
  render(): void;
  button(name: MenuItem): HTMLButtonElement | null;
  dispose(): void;
}

export type MenuItem = 'sound' | 'widget' | 'herbarium' | 'data' | 'hints';

export interface MenuActions {
  openHerbarium(opener: HTMLElement): void;
  openData(opener: HTMLElement): void;
  openHints(opener: HTMLElement): void;
}

export function createMenu(ctx: UIContext, actions: MenuActions): Menu {
  const { controller, store, audio, widget } = ctx.deps;
  const buttons = new Map<MenuItem, HTMLButtonElement>();

  const item = (name: MenuItem, icon: IconName, label: string, onclick: (b: HTMLButtonElement) => void, extra: Record<string, unknown> = {}) => {
    const b = h(
      'button.icon-btn.menu-item',
      { type: 'button', 'data-anchor': name, 'data-menu': name, 'aria-label': label, ...extra },
      h('span.icon-slot', {}, fragment(ICONS[icon])),
      h('span.menu-label', { 'aria-hidden': 'true' }, label),
    );
    b.addEventListener('click', () => onclick(b));
    buttons.set(name, b);
    return b;
  };

  const sound = item('sound', 'soundOff', 'Sound', () => {
    const muted = !store.get().settings.muted;
    controller.updateSettings({ muted }); // emits settings:changed (audio follows) and retires the tip
    if (audio) {
      audio.setMuted(muted);
      audio.unlock(); // inside the click: satisfies the autoplay policy
    }
    render();
  });
  sound.setAttribute('aria-pressed', 'false');

  const items: HTMLButtonElement[] = [sound];
  let offWidget: (() => void) | undefined;
  if (widget?.supported) {
    const w = item('widget', 'floating', 'Floating timer', () => {
      void widget.open();
      controller.retireTip('widget');
      render();
    });
    w.setAttribute('aria-pressed', 'false');
    items.push(w);
    offWidget = widget.onChange?.(() => render());
  }
  items.push(
    item('herbarium', 'book', 'Pressed flowers', (b) => actions.openHerbarium(b), { 'aria-haspopup': 'dialog' }),
    item('data', 'data', 'Garden data', (b) => actions.openData(b), { 'aria-haspopup': 'dialog' }),
    item('hints', 'info', 'Hints', (b) => actions.openHints(b), { 'aria-haspopup': 'dialog' }),
  );

  const el = h('nav.menu', { 'aria-label': 'Garden menu', 'data-ui': 'menu' }, ...items);

  function render(): void {
    const muted = store.get().settings.muted;
    const on = !muted;
    if (sound.getAttribute('aria-pressed') !== String(on)) {
      sound.setAttribute('aria-pressed', String(on));
      sound.querySelector('.icon-slot')!.replaceChildren(fragment(on ? ICONS.soundOn : ICONS.soundOff));
      sound.querySelector('.menu-label')!.textContent = on ? 'Sound on' : 'Sound off';
      sound.setAttribute('aria-label', 'Garden sounds');
    }
    const w = buttons.get('widget');
    if (w && widget) w.setAttribute('aria-pressed', String(widget.isOpen()));
  }

  // first paint of the sound state
  sound.setAttribute('aria-pressed', 'unset');
  render();

  return {
    el,
    render,
    button: (name) => buttons.get(name) ?? null,
    dispose() {
      offWidget?.();
    },
  };
}
