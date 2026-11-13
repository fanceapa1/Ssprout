/** The coast's creatures: every kind of its table that has a module (ADR 0346, 0373). */
import bee from '../bee';
import butterfly from '../butterfly';
import heron from '../heron';
import type { CreatureDef } from '../lib/def';
import swallow from '../swallow';

const defs: readonly CreatureDef[] = [bee, butterfly, heron, swallow];
export default defs;
