import { shrubSuite } from '../lib/suites';
import { buildPeony } from './tree-peony';

shrubSuite('tree-peony', buildPeony, { habitats: ['meadow', 'back'] });
