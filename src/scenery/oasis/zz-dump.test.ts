import { it } from 'vitest';
import { OASIS_GROUND, OASIS_PERCHES, OASIS_STANDS, OASIS_WALLS, oasisPerspective, intoBasin, inOued } from './wildlife';
it('dump', () => {
  for (const p of OASIS_PERCHES) console.log(p.id, p.kind, p.x, p.y, p.spread, p.slope ?? '', p.depth, p.scale ?? oasisPerspective(p.x, p.y));
  for (const s of OASIS_STANDS) console.log('stand', s.x, s.y, intoBasin(s).toFixed(1), inOued(s));
  for (const w of OASIS_WALLS) console.log('wall', w.id, w.top.length, w.top[0], w.top[w.top.length - 1], w.h);
  console.log(OASIS_GROUND.length);
});
