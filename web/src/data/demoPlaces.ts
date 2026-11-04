import type { Place } from '@/types';

/**
 * OFFLINE SAMPLE DATASET — used only when the live search service is not
 * configured or unreachable. Coordinates are approximate public landmark /
 * city-centre positions. Every record is tagged `source: 'demo'` and the UI
 * labels it as sample data. It contains no traffic or incident information.
 */
type DemoSeed = [id: string, name: string, address: string, postcode: string, state: string, lat: number, lng: number, kind: Place['kind'], category?: string];

const SEED: DemoSeed[] = [
  // States & major cities
  ['kl', 'Kuala Lumpur', 'Federal Territory of Kuala Lumpur', '50000', 'Kuala Lumpur', 3.1466, 101.6958, 'place'],
  ['putrajaya', 'Putrajaya', 'Federal Territory of Putrajaya', '62000', 'Putrajaya', 2.9264, 101.6964, 'place'],
  ['shah-alam', 'Shah Alam', 'Selangor', '40000', 'Selangor', 3.0733, 101.5185, 'place'],
  ['petaling-jaya', 'Petaling Jaya', 'Selangor', '46000', 'Selangor', 3.1073, 101.6067, 'place'],
  ['cyberjaya', 'Cyberjaya', 'Sepang, Selangor', '63000', 'Selangor', 2.9213, 101.6559, 'place'],
  ['klang', 'Klang', 'Selangor', '41000', 'Selangor', 3.0449, 101.4456, 'place'],
  ['seremban', 'Seremban', 'Negeri Sembilan', '70000', 'Negeri Sembilan', 2.7297, 101.9381, 'place'],
  ['melaka', 'Melaka City', 'Melaka', '75000', 'Melaka', 2.1896, 102.2501, 'place'],
  ['johor-bahru', 'Johor Bahru', 'Johor', '80000', 'Johor', 1.4927, 103.7414, 'place'],
  ['ipoh', 'Ipoh', 'Perak', '30000', 'Perak', 4.5975, 101.0901, 'place'],
  ['george-town', 'George Town', 'Pulau Pinang', '10200', 'Pulau Pinang', 5.4141, 100.3288, 'place'],
  ['alor-setar', 'Alor Setar', 'Kedah', '05000', 'Kedah', 6.1248, 100.3678, 'place'],
  ['kangar', 'Kangar', 'Perlis', '01000', 'Perlis', 6.4414, 100.1986, 'place'],
  ['kota-bharu', 'Kota Bharu', 'Kelantan', '15000', 'Kelantan', 6.1254, 102.2381, 'place'],
  ['kuala-terengganu', 'Kuala Terengganu', 'Terengganu', '20000', 'Terengganu', 5.3296, 103.137, 'place'],
  ['kuantan', 'Kuantan', 'Pahang', '25000', 'Pahang', 3.8077, 103.326, 'place'],
  ['kota-kinabalu', 'Kota Kinabalu', 'Sabah', '88000', 'Sabah', 5.9804, 116.0735, 'place'],
  ['kuching', 'Kuching', 'Sarawak', '93000', 'Sarawak', 1.5535, 110.3593, 'place'],
  ['langkawi', 'Langkawi (Kuah)', 'Kedah', '07000', 'Kedah', 6.3166, 99.85, 'place'],
  // Landmarks & transport hubs
  ['klcc', 'Petronas Twin Towers (KLCC)', 'Jalan Ampang, Kuala Lumpur', '50088', 'Kuala Lumpur', 3.1579, 101.7116, 'poi', 'landmark'],
  ['kl-sentral', 'KL Sentral', 'Jalan Stesen Sentral, Kuala Lumpur', '50470', 'Kuala Lumpur', 3.134, 101.6865, 'poi', 'transit station'],
  ['pavilion', 'Pavilion Kuala Lumpur', 'Jalan Bukit Bintang, Kuala Lumpur', '55100', 'Kuala Lumpur', 3.1488, 101.7133, 'poi', 'shopping mall'],
  ['mid-valley', 'Mid Valley Megamall', 'Lingkaran Syed Putra, Kuala Lumpur', '59200', 'Kuala Lumpur', 3.1179, 101.6776, 'poi', 'shopping mall'],
  ['batu-caves', 'Batu Caves', 'Gombak, Selangor', '68100', 'Selangor', 3.2379, 101.684, 'poi', 'landmark'],
  ['sunway-pyramid', 'Sunway Pyramid', 'Bandar Sunway, Selangor', '47500', 'Selangor', 3.0733, 101.607, 'poi', 'shopping mall'],
  ['klia', 'KLIA Terminal 1', 'Sepang, Selangor', '64000', 'Selangor', 2.7456, 101.7072, 'poi', 'airport'],
  ['klia2', 'KLIA Terminal 2', 'Sepang, Selangor', '64000', 'Selangor', 2.7438, 101.6863, 'poi', 'airport'],
  ['genting', 'Genting Highlands', 'Bentong, Pahang', '69000', 'Pahang', 3.4236, 101.7932, 'place'],
  ['penang-bridge', 'Penang Bridge', 'Pulau Pinang', '11700', 'Pulau Pinang', 5.355, 100.3555, 'poi', 'bridge'],
  ['a-famosa', 'A Famosa', 'Jalan Parameswara, Melaka', '75000', 'Melaka', 2.1913, 102.2505, 'poi', 'landmark'],
];

export const DEMO_PLACES: Place[] = SEED.map(([id, name, address, postcode, state, lat, lng, kind, category]) => ({
  id: `demo:${id}`,
  name,
  address: `${postcode} ${address}`,
  postcode,
  state,
  coordinates: { lat, lng },
  kind,
  category,
  source: 'demo',
}));

/** Quick-jump list for the Explore tab (Malaysia-first). */
export const STATE_CAPITALS: { state: string; placeId: string }[] = [
  { state: 'Kuala Lumpur', placeId: 'demo:kl' },
  { state: 'Selangor', placeId: 'demo:shah-alam' },
  { state: 'Putrajaya', placeId: 'demo:putrajaya' },
  { state: 'Negeri Sembilan', placeId: 'demo:seremban' },
  { state: 'Melaka', placeId: 'demo:melaka' },
  { state: 'Johor', placeId: 'demo:johor-bahru' },
  { state: 'Pahang', placeId: 'demo:kuantan' },
  { state: 'Terengganu', placeId: 'demo:kuala-terengganu' },
  { state: 'Kelantan', placeId: 'demo:kota-bharu' },
  { state: 'Perak', placeId: 'demo:ipoh' },
  { state: 'Pulau Pinang', placeId: 'demo:george-town' },
  { state: 'Kedah', placeId: 'demo:alor-setar' },
  { state: 'Perlis', placeId: 'demo:kangar' },
  { state: 'Sabah', placeId: 'demo:kota-kinabalu' },
  { state: 'Sarawak', placeId: 'demo:kuching' },
];
