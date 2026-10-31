import { shrubSuite } from '../lib/suites';
import { buildHydrangea } from './hydrangea';

shrubSuite('hydrangea', buildHydrangea, { habitats: ['meadow', 'shore', 'back'] });
