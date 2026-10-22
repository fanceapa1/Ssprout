/**
 * A short note for every species on its place in Japanese gardens and culture, shown on the plant
 * card (SPEC §3a, ADR 0167). Two or three plain sentences each: what a gardener or a reader of old
 * poems would know about it, said quietly. Kept apart from the species definitions (they paint in
 * workers; this is only text) and checked by `notes.test.ts`: every registered species has one.
 */
export const SPECIES_NOTES: Readonly<Record<string, string>> = {
  anemone:
    'Despite its English name it came from China long ago, and it grows wild in the cool valley of Kibune north of Kyoto, which gives it the name kibune-giku. It flowers in early autumn in the half-shade of temple gardens, when little else is in bloom.',
  azalea:
    'Satsuki azaleas are sheared into rounded mounds, the karikomi that stand for hills, clouds or waves in a dry garden. They flower in the fifth month of the old calendar, satsuki, which is where their name comes from.',
  'balloon-flower':
    'Kikyō is one of the seven flowers of autumn named in the Man’yōshū, and its five-pointed bloom became a family crest. The buds swell like small paper lanterns before they open.',
  'black-pine':
    'The black pine is the backbone of a Japanese garden, planted by water to stand for the seashore and for long life. Gardeners pinch its new candles in spring and pluck old needles by hand in winter so light passes through its layered branches.',
  camellia:
    'Native to Japan, the camellia flowers through the cold months, and a single bud is the winter flower of the tea room. It lets its blossoms fall whole, and many gardeners leave them lying red on the moss.',
  chrysanthemum:
    'The sixteen-petalled chrysanthemum is the emblem of the imperial house, and the ninth day of the ninth month was once its festival. In autumn, growers still show plants trained for a whole year into cascades and single giant blooms.',
  cosmos:
    'Cosmos came from Mexico in the Meiji era and was soon written with the characters for autumn cherry blossom. Whole fields of it sway beside rice paddies and along country roads in early autumn.',
  dandelion:
    'Japan’s own dandelions flower only in spring, while the European kind blooms all year and has taken over most towns. Schoolchildren and volunteers count the two by the roadside as a simple measure of how wild a place still is.',
  'forget-me-not':
    'Its Japanese name is a Meiji-era translation of the European one, word for word. A native relative, ezo-murasaki, grows in the meadows of Hokkaido, and garden forms have gone wild along cold, clear streams.',
  ginkgo:
    'Ginkgos stand beside temples and shrines, some for many centuries, and were planted there partly because their thick leaves and bark resist fire. In late autumn the whole tree turns gold and lets its leaves go within a few days.',
  hydrangea:
    'Ajisai is native to Japan and flowers in the rainy season of June, when temples such as Meigetsu-in in Kamakura fill with visitors. Its colour follows the soil: blue where it is acid, pink where it is not.',
  'japanese-iris':
    'Hanashōbu was bred for centuries, above all in the Edo period, into its Edo, Higo and Ise lines, and is grown in shallow fields walked by plank bridges. Its name borrows from shōbu, the sweet flag of the Boys’ Day bath, which is not an iris at all.',
  'japanese-maple':
    'Going out to see the autumn maples, momijigari, has been a custom since the Heian court. Gardeners plant momiji over moss and water so the red is seen twice, and many prize its fresh green in early summer just as much.',
  'spider-lily':
    'Higanbana flowers around the autumn equinox, the time of higan, along the banks of rice paddies and at the edges of graveyards. Its bulbs are poisonous, and it was planted there to keep moles and mice away; its leaves come only after the flowers have gone.',
  lotus:
    'In Buddhism the lotus rising clean from the mud stands for the awakened mind, and temple ponds are planted with it. Each flower opens at dawn and closes by midday for a few mornings, and seeds found in an ancient peat bed near Tokyo flowered again after some two thousand years.',
  'maidenhair-fern':
    'Kujakushida means peacock fern, for its fronds fanned out like a tail. It grows in cool mountain woods, and gardeners tuck it into the damp shade beside stones and stone water basins.',
  'water-lily':
    'Japan’s native water lily is called hitsujigusa, sheep grass, because it was said to open at the hour of the sheep, early in the afternoon. It floats in old temple ponds and moats, small and white.',
  'plum-blossom':
    'Ume flowers in the cold at the end of winter, and in the oldest poems hanami meant viewing plum, not cherry. With the pine and the bamboo it is one of the three friends of winter, and the shrines of Sugawara no Michizane keep the trees he loved.',
  'susuki-grass':
    'Susuki is one of the seven flowers of autumn and is set out with rice dumplings for the moon viewing in the ninth month. Its stems were once cut for thatch, and its plumes still silver the hills in October.',
  wisteria:
    'Fuji is trained over flat trellises so its long clusters hang overhead, as at Kameido Tenjin in Tokyo, where Hiroshige drew them above an arched bridge. Some vines, like the great wisteria at Ashikaga, are well over a century old.',
  'tree-peony':
    'Botan came from China as a medicinal plant and became the king of flowers, painted beside lions on screens and temple carvings. Winter-flowering kinds are sheltered under small straw hats, and temples such as Hase-dera in Nara are known for their peonies.',
  'weeping-cherry':
    'Old weeping cherries are planted at temples and in parks and are visited like elders, such as the one in Kyoto’s Maruyama Park lit at night in spring. Miharu’s Takizakura, the waterfall cherry in Fukushima, is said to be over a thousand years old.',
  violet:
    'Bashō wrote of coming over a mountain path and being charmed, he could not say why, by a wild violet. One explanation of the name sumire is a carpenter’s ink-line tool, the sumi-ire, which its flower resembles.',
  'white-clover':
    'Its name, shirotsumekusa, means white packing grass: dried clover cushioned crates of glassware shipped from the Netherlands in the Edo period. Seeds in the packing took root, and it has grown in Japanese lawns and verges ever since.',
  'wild-strawberry':
    'Garden strawberries arrived with Dutch traders and are still called oranda-ichigo, Dutch strawberry, by botanists. The native wild ones are small mountain berries, found by looking down along forest paths in early summer.',
};

/** The note for a species, or null (fixture and placeholder species have none). */
export function speciesNote(id: string): string | null {
  return SPECIES_NOTES[id] ?? null;
}
