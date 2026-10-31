import { shrubSuite } from '../lib/suites';
import { buildAzalea } from './azalea';

shrubSuite('azalea', buildAzalea, { habitats: ['meadow', 'rock', 'path'], sizeClass: 'medium' });
