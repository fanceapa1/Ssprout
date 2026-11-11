/** The oasis's creatures: every kind of its table that has a module (ADR 0346). */
import bee from '../bee';
import bunting from '../bunting';
import butterfly from '../butterfly';
import dove from '../dove';
import dropwing from '../dropwing';
import heron from '../heron';
import leaf from '../leaf';
import type { CreatureDef } from '../lib/def';
import saharaFrog from '../sahara-frog';
import strider from '../strider';
import swallow from '../swallow';

const defs: readonly CreatureDef[] = [bee, bunting, butterfly, dove, dropwing, heron, leaf, saharaFrog, strider, swallow];
export default defs;
