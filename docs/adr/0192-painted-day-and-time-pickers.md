# ADR 0192 — Painted day and time pickers in the calendar's formats

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0177 (the schedule editor)

## Context
The schedule editor used `<input type="date">` and `<input type="time">`. Their display and pop-up
follow the **operating system's** locale (dd/mm/yyyy, a 24-hour clock on the owner's machine). The
calendar formats with `Intl` and the **browser's** language (12 hours in en-US). A session planned
for "16:30" in the editor showed as "4:30 PM" in the calendar. The native pop-ups also break the
house style.

## Options
- Keep native inputs and only relabel. Their display cannot be set from the page.
- Text fields with masks. These are fragile across locales and poor on touch.
- `<select>`s with our own labels. They are reliable but have OS pop-ups and 288 time options.
- **Custom pickers in the house style that use the calendar's own `Intl` formats.**

## Decision
`src/ui/pickers.ts`: each picker is a **field** (a real button showing the value, named by its label
and value, `aria-expanded`, `aria-controls`). It **unfolds a panel inline** under its row. There is
no floating popover to position or clip inside a scrolling sheet, and it works the same on phones.
One panel is open at a time.
- **Day**: a month grid (`<table role="grid">`, gridcells with `aria-selected`, day buttons named
  with the full date, `aria-current="date"` on today).
  - Keys: arrows move by day and week, Home/End go to the week's ends, PageUp/PageDown move by
    month (with Shift, by year). Enter or Space chooses, and Esc folds the panel without choosing.
  - Focus returns to the field.
  - Prev/next month buttons. The week starts on the locale's first day, as in the calendar.
  - The chosen day has the calendar's vermilion brush ring and today a brush underline. Days of
    other months and past days are faint.
- **Time**: radio groups of paper chips for **Hour**, **Minutes** (in fives; an odd minute keeps
  its own chip) and, on a 12-hour clock only, the locale's **AM / PM**.
  - Arrows move and choose, as with every chip group in the app. "Done" or Esc folds the panel.
- **Formats** come from `pickerFormat()`. The time uses the calendar's own
  `{ hour: 'numeric', minute: '2-digit' }` and the day uses weekday, day and month, with the year
  when it is another year. `uses12h()` reads the locale's `hourCycle`. The editor therefore says a
  time exactly as the calendar does, in every locale.
- Esc inside a panel is stopped there, so it does not close the sheet.
- The panel's keys are not taken by the page's smooth scroll.
- Values stay `YYYY-MM-DD` / `HH:MM` (the model is unchanged). `data-value` on the fields and
  `sprout.ui.state().scheduleSheet.{date,time}` expose them.

## Consequences
The editor and the calendar agree in en-US (12 h) and en-GB (24 h), which the e2e tests check.
Keyboard and screen reader use is covered by jsdom unit tests (`pickers.test.ts`) and e2e
(`calendar · the editor speaks the calendar's clock`). The native date and clock glyph styling is
gone. Studio: `calendar/pickers`.
