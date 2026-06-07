export type MalaysiaState =
  | 'Johor'
  | 'Kedah'
  | 'Kelantan'
  | 'Melaka'
  | 'Negeri Sembilan'
  | 'Pahang'
  | 'Penang'
  | 'Perak'
  | 'Perlis'
  | 'Sabah'
  | 'Sarawak'
  | 'Selangor'
  | 'Terengganu'
  | 'Kuala Lumpur'
  | 'Labuan'
  | 'Putrajaya';

type Bounds = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

export type AddressRegionHint = {
  postcode?: string;
  state?: MalaysiaState;
  source?: 'postcode' | 'text';
};

export const MALAYSIA_BOUNDS: Bounds = { latMin: 0.8, latMax: 7.5, lngMin: 99.5, lngMax: 119.5 };

const STATE_BOUNDS: Record<MalaysiaState, Bounds> = {
  Johor: { latMin: 1.1, latMax: 2.95, lngMin: 102.35, lngMax: 104.55 },
  Kedah: { latMin: 5.0, latMax: 6.75, lngMin: 99.45, lngMax: 101.25 },
  Kelantan: { latMin: 4.45, latMax: 6.35, lngMin: 101.25, lngMax: 102.85 },
  Melaka: { latMin: 1.95, latMax: 2.6, lngMin: 101.75, lngMax: 102.6 },
  'Negeri Sembilan': { latMin: 2.35, latMax: 3.25, lngMin: 101.55, lngMax: 102.8 },
  Pahang: { latMin: 2.35, latMax: 4.85, lngMin: 101.3, lngMax: 104.0 },
  Penang: { latMin: 5.05, latMax: 5.75, lngMin: 100.05, lngMax: 100.65 },
  Perak: { latMin: 3.45, latMax: 5.95, lngMin: 100.25, lngMax: 101.85 },
  Perlis: { latMin: 6.15, latMax: 6.8, lngMin: 99.95, lngMax: 100.55 },
  Sabah: { latMin: 4.0, latMax: 7.5, lngMin: 115.2, lngMax: 119.5 },
  Sarawak: { latMin: 0.8, latMax: 5.15, lngMin: 109.45, lngMax: 115.85 },
  Selangor: { latMin: 2.55, latMax: 3.9, lngMin: 100.65, lngMax: 102.05 },
  Terengganu: { latMin: 3.8, latMax: 5.95, lngMin: 101.95, lngMax: 103.75 },
  'Kuala Lumpur': { latMin: 2.9, latMax: 3.4, lngMin: 101.5, lngMax: 101.9 },
  Labuan: { latMin: 5.1, latMax: 5.5, lngMin: 114.95, lngMax: 115.45 },
  Putrajaya: { latMin: 2.85, latMax: 3.05, lngMin: 101.62, lngMax: 101.78 },
};

const STATE_CENTERS: Record<MalaysiaState, { lat: number; lng: number }> = {
  Johor: { lat: 1.85, lng: 103.1 },
  Kedah: { lat: 5.65, lng: 100.5 },
  Kelantan: { lat: 5.35, lng: 102.0 },
  Melaka: { lat: 2.25, lng: 102.25 },
  'Negeri Sembilan': { lat: 2.75, lng: 102.25 },
  Pahang: { lat: 3.8, lng: 102.45 },
  Penang: { lat: 5.38, lng: 100.32 },
  Perak: { lat: 4.6, lng: 101.05 },
  Perlis: { lat: 6.45, lng: 100.2 },
  Sabah: { lat: 5.35, lng: 117.1 },
  Sarawak: { lat: 2.8, lng: 113.0 },
  Selangor: { lat: 3.2, lng: 101.45 },
  Terengganu: { lat: 5.0, lng: 103.0 },
  'Kuala Lumpur': { lat: 3.139, lng: 101.6869 },
  Labuan: { lat: 5.28, lng: 115.23 },
  Putrajaya: { lat: 2.9264, lng: 101.6964 },
};

const POSTCODE_RANGES: Array<{ min: number; max: number; state: MalaysiaState }> = [
  { min: 1000, max: 2999, state: 'Perlis' },
  { min: 5000, max: 9899, state: 'Kedah' },
  { min: 10000, max: 14999, state: 'Penang' },
  { min: 15000, max: 18999, state: 'Kelantan' },
  { min: 20000, max: 24999, state: 'Terengganu' },
  { min: 25000, max: 28999, state: 'Pahang' },
  { min: 30000, max: 36999, state: 'Perak' },
  { min: 40000, max: 48999, state: 'Selangor' },
  { min: 50000, max: 60999, state: 'Kuala Lumpur' },
  { min: 62000, max: 62999, state: 'Putrajaya' },
  { min: 63000, max: 68999, state: 'Selangor' },
  { min: 70000, max: 73999, state: 'Negeri Sembilan' },
  { min: 75000, max: 78999, state: 'Melaka' },
  { min: 79000, max: 86999, state: 'Johor' },
  { min: 87000, max: 87999, state: 'Labuan' },
  { min: 88000, max: 91999, state: 'Sabah' },
  { min: 93000, max: 98999, state: 'Sarawak' },
];

const STATE_ALIASES: Record<MalaysiaState, string[]> = {
  Johor: ['johor', 'jhr'],
  Kedah: [
    'kedah',
    'kdh',
    'darul aman',
    'alor setar',
    'alor star',
    'sungai petani',
    'sg petani',
    'jitra',
    'kulim',
    'langkawi',
    'gurun',
    'pendang',
    'yan',
    'baling',
    'sik',
    'changlun',
    'kubang pasu',
    'pokok sena',
    'padang serai',
    'kuala kedah',
  ],
  Kelantan: ['kelantan', 'kota bharu', 'pasir mas', 'tanah merah'],
  Melaka: ['melaka', 'malacca'],
  'Negeri Sembilan': ['negeri sembilan', 'n sembilan', 'seremban', 'nilai', 'port dickson'],
  Pahang: ['pahang', 'kuantan', 'temerloh', 'bentong'],
  Penang: ['pulau pinang', 'penang', 'p pinang', 'george town', 'bukit mertajam', 'butterworth'],
  Perak: ['perak', 'ipoh', 'taiping', 'manjung', 'teluk intan'],
  Perlis: ['perlis', 'kangar', 'arau', 'padang besar'],
  Sabah: ['sabah', 'kota kinabalu', 'sandakan', 'tawau'],
  Sarawak: ['sarawak', 'kuching', 'miri', 'sibu', 'bintulu'],
  Selangor: ['selangor', 'shah alam', 'petaling jaya', 'subang jaya', 'puchong', 'klang', 'ampang'],
  Terengganu: ['terengganu', 'kuala terengganu', 'kemaman', 'dungun'],
  'Kuala Lumpur': ['kuala lumpur', 'wilayah persekutuan kuala lumpur', 'wp kuala lumpur', 'w p kuala lumpur'],
  Labuan: ['labuan', 'wilayah persekutuan labuan', 'wp labuan', 'w p labuan'],
  Putrajaya: ['putrajaya', 'wilayah persekutuan putrajaya', 'wp putrajaya', 'w p putrajaya'],
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAlias(text: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;
  return new RegExp(`(^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text);
}

export function extractPostcode(address: string): string | undefined {
  return address.match(/\b\d{5}\b/)?.[0];
}

export function stateFromPostcode(postcode: string): MalaysiaState | undefined {
  const value = Number(postcode);
  if (!Number.isFinite(value)) return undefined;
  return POSTCODE_RANGES.find(range => value >= range.min && value <= range.max)?.state;
}

export function stateFromText(value: string): MalaysiaState | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;

  for (const [state, aliases] of Object.entries(STATE_ALIASES) as Array<[MalaysiaState, string[]]>) {
    if (aliases.some(alias => containsAlias(text, alias))) {
      return state;
    }
  }

  return undefined;
}

export function inferAddressRegion(address: string): AddressRegionHint {
  const postcode = extractPostcode(address);
  const postcodeState = postcode ? stateFromPostcode(postcode) : undefined;
  if (postcodeState) {
    return { postcode, state: postcodeState, source: 'postcode' };
  }

  const textState = stateFromText(address);
  return { postcode, state: textState, source: textState ? 'text' : undefined };
}

export function isWithinMalaysia(lat: number, lng: number): boolean {
  return lat >= MALAYSIA_BOUNDS.latMin && lat <= MALAYSIA_BOUNDS.latMax &&
    lng >= MALAYSIA_BOUNDS.lngMin && lng <= MALAYSIA_BOUNDS.lngMax;
}

export function isWithinStateBounds(state: MalaysiaState, lat: number, lng: number): boolean {
  const bounds = STATE_BOUNDS[state];
  return lat >= bounds.latMin && lat <= bounds.latMax &&
    lng >= bounds.lngMin && lng <= bounds.lngMax;
}

export function isCoordinateCompatibleWithAddress(address: string, lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinMalaysia(lat, lng)) {
    return false;
  }

  const hint = inferAddressRegion(address);
  if (!hint.state) return true;
  return isWithinStateBounds(hint.state, lat, lng);
}

export function describeRegionHint(hint: AddressRegionHint): string {
  if (hint.postcode && hint.state) return `${hint.postcode} / ${hint.state}`;
  if (hint.state) return hint.state;
  if (hint.postcode) return hint.postcode;
  return 'Malaysia';
}

export function regionMetadataForAddress(address: string): { postcode?: string; state?: MalaysiaState } {
  const hint = inferAddressRegion(address);
  return {
    ...(hint.postcode ? { postcode: hint.postcode } : {}),
    ...(hint.state ? { state: hint.state } : {}),
  };
}

export function addressRegionMatchesMetadata(
  address: string,
  metadata: { postcode?: unknown; state?: unknown }
): boolean {
  const hint = inferAddressRegion(address);
  if (!hint.postcode && !hint.state) return true;

  if (hint.postcode) {
    const metadataPostcode = typeof metadata.postcode === 'string' ? metadata.postcode.trim() : '';
    if (metadataPostcode !== hint.postcode) return false;
  }

  if (hint.state) {
    const metadataState = typeof metadata.state === 'string' ? stateFromText(metadata.state) : undefined;
    if (metadataState !== hint.state) return false;
  }

  return true;
}

export function buildAddressWithRegionHint(address: string): string {
  const trimmed = address.trim();
  const hint = inferAddressRegion(trimmed);
  const normalized = normalizeText(trimmed);
  const parts = [trimmed];

  if (hint.state && !containsAlias(normalized, hint.state)) {
    parts.push(hint.state);
  }

  if (!containsAlias(normalized, 'malaysia')) {
    parts.push('Malaysia');
  }

  return parts.join(', ');
}

export function fallbackCoordinateForAddress(address: string): { lat: number; lng: number; isApproximate: true } {
  const hint = inferAddressRegion(address);
  const center = hint.state ? STATE_CENTERS[hint.state] : STATE_CENTERS['Kuala Lumpur'];
  return { ...center, isApproximate: true };
}
