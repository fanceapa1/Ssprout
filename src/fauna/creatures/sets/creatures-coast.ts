/** The coast's creatures: every kind of its table that has a module (ADR 0346, 0373). */
import bee from '../bee';
import butterfly from '../butterfly';
import cat from '../cat';
import gull from '../gull';
import heron from '../heron';
import type { CreatureDef } from '../lib/def';
import swallow from '../swallow';
import tortoise from '../tortoise';

const defs: readonly CreatureDef[] = [bee, butterfly, cat, gull, heron, swallow, tortoise];
export default defs;
