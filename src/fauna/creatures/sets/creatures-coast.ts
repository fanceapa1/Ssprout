/** The coast's creatures: every kind of its table that has a module (ADR 0346, 0373). */
import bee from '../bee';
import butterfly from '../butterfly';
import cat from '../cat';
import cicada from '../cicada';
import dolphin from '../dolphin';
import goat from '../goat';
import greenLizard from '../green-lizard';
import gull from '../gull';
import heron from '../heron';
import type { CreatureDef } from '../lib/def';
import rockCrab from '../rock-crab';
import rockThrush from '../rock-thrush';
import scopsOwl from '../scops-owl';
import swallow from '../swallow';
import tortoise from '../tortoise';

const defs: readonly CreatureDef[] = [bee, butterfly, cat, cicada, dolphin, goat, greenLizard, gull, heron, rockCrab, rockThrush, scopsOwl, swallow, tortoise];
export default defs;
