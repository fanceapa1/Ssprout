/** The coast's creatures: every kind of its table that has a module (ADR 0346, 0373). */
import bee from '../bee';
import butterfly from '../butterfly';
import cat from '../cat';
import cicada from '../cicada';
import dolphin from '../dolphin';
import goat from '../goat';
import gull from '../gull';
import heron from '../heron';
import type { CreatureDef } from '../lib/def';
import rockCrab from '../rock-crab';
import rockThrush from '../rock-thrush';
import swallow from '../swallow';
import tortoise from '../tortoise';

const defs: readonly CreatureDef[] = [bee, butterfly, cat, cicada, dolphin, goat, gull, heron, rockCrab, rockThrush, swallow, tortoise];
export default defs;
