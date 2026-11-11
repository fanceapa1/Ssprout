/** The waterfall's creatures: every kind of its table that has a module (ADR 0346). */
import bee from '../bee';
import bird from '../bird';
import butterfly from '../butterfly';
import damselfly from '../damselfly';
import dipper from '../dipper';
import dragonfly from '../dragonfly';
import firefly from '../firefly';
import heron from '../heron';
import iwana from '../iwana';
import iwatsubame from '../iwatsubame';
import kajika from '../kajika';
import leaf from '../leaf';
import type { CreatureDef } from '../lib/def';
import sawagani from '../sawagani';
import strider from '../strider';
import yamasemi from '../yamasemi';

const defs: readonly CreatureDef[] = [bee, bird, butterfly, damselfly, dipper, dragonfly, firefly, heron, iwana, iwatsubame, kajika, leaf, sawagani, strider, yamasemi];
export default defs;
