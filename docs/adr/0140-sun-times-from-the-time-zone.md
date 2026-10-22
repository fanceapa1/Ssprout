# ADR 0140 — Sun times from the time zone

- Status: accepted
- Date: 2026-10-23
- Context: ADR 0005 (owner: "real sunrise/sunset for today's date at a rough location guessed from
  the timezone; no permission prompt").

## Context
The garden's light follows the system clock in four phases placed on the real sun. We need
today's sunrise, sunset and civil twilight without asking for a location and without a network.

## Decision
- `src/ambience/solar.ts` (pure): NOAA's solar equations — declination and equation of time from
  the Julian century, the hour angle for zenith 90.833° (sunrise/sunset, refraction included) and
  96° (civil twilight), each refined once with the declination at the event. `sunAltitude(t, at)`
  for any instant; `moonPhase(t)` from the mean synodic month.
- **The day is the local solar day around `now`** (the mean-solar day containing it, i.e. the
  noon nearest to now). Only longitude defines it: no time zone offset, so results are identical
  in tests, workers and the browser, whatever the machine's zone.
- **Polar edge cases** return `null` events instead of NaN: no sunrise/sunset (polar day or night,
  told apart by the noon altitude), no civil dawn/dusk (white nights, or deep polar night).
  Latitudes are clamped to ±89.9°.
- `src/ambience/zones.ts`: a table of ~110 common IANA zones → the zone city's lat/lon. Unknown
  zones fall back to the longitude of the current UTC offset (15° per hour) and a mid latitude of
  the zone's region (Europe 48, Australia −30, …; default 40). `browserLocation()` reads
  `Intl.DateTimeFormat().resolvedOptions().timeZone`.

## Consequences
- Accurate to about a minute against NOAA / timeanddate for the tested cities; a zone city can be
  a few hundred km from the user, which moves sunrise by minutes — invisible in a painting.
- No geolocation prompt, nothing leaves the device. Dev can pin a location
  (`DaylightSource.setLocation`) for tests.
