/** The Japanese garden's creatures: every kind of its table that has a module (ADR 0346). */
import bee from '../bee';
import bird from '../bird';
import butterfly from '../butterfly';
import dragonfly from '../dragonfly';
import frog from '../frog';
import heron from '../heron';
import koi from '../koi';
import type { CreatureDef } from '../lib/def';
import leaf from '../leaf';
import strider from '../strider';
import swallow from '../swallow';

const defs: readonly CreatureDef[] = [bee, bird, butterfly, dragonfly, frog, heron, koi, leaf, strider, swallow];
export default defs;
