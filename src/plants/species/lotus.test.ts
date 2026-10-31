import { shrubSuite } from '../lib/suites';
import { buildLotus } from './lotus';

shrubSuite('lotus', buildLotus, { habitats: ['water'] });
