/**
 * Canonical affiliate partner registry, HTTPS host allowlist, and partner-native
 * subID attribution helpers shared across Web, Mobile, and validation layers.
 */

export const AFFILIATE_DISCLOSURE_SHORT =
  'We may earn a commission at no extra cost to you.';

export const AFFILIATE_DISCLOSURE_FULL =
  'Faroway may earn a commission when you book through partner links, at no extra cost to you.';

export const AFFILIATE_PARTNER_IDS = [
  'viator',
  'getyourguide',
  'travelpayouts',
  'stay22',
  'booking',
  'expedia',
  'safetywing',
  'airalo',
  'klook',
  'discovercars',
  'hostelworld',
  'duffel',
  'tripadvisor',
  'opentable',
  'skyscanner',
  'ivisa',
  'wise',
] as const;

export type AffiliatePartnerId = (typeof AFFILIATE_PARTNER_IDS)[number];

export type AffiliateVertical =
  | 'hotels'
  | 'activities'
  | 'flights'
  | 'dining'
  | 'cars'
  | 'insurance'
  | 'esim'
  | 'visas'
  | 'finance'
  | 'multi';

export type AffiliateClickItemType =
  | 'hotel'
  | 'activity'
  | 'restaurant'
  | 'flight'
  | 'transport';

export interface AffiliatePartnerMeta {
  id: AffiliatePartnerId;
  name: string;
  verticals: readonly AffiliateVertical[];
  defaultItemType: AffiliateClickItemType;
  allowedHosts: readonly string[];
  subIdParam: string;
  preservedParams: readonly string[];
  appendUtm: boolean;
  supportsConversionWebhook: boolean;
}

export const AFFILIATE_PARTNERS: Record<AffiliatePartnerId, AffiliatePartnerMeta> = {
  viator: {
    id: 'viator',
    name: 'Viator',
    verticals: ['activities'],
    defaultItemType: 'activity',
    allowedHosts: ['viator.com', 'www.viator.com'],
    subIdParam: 'campaign',
    preservedParams: ['pid', 'mcid', 'medium'],
    appendUtm: false,
    supportsConversionWebhook: true,
  },
  getyourguide: {
    id: 'getyourguide',
    name: 'GetYourGuide',
    verticals: ['activities'],
    defaultItemType: 'activity',
    allowedHosts: ['getyourguide.com', 'www.getyourguide.com'],
    subIdParam: 'cmp',
    preservedParams: ['partner_id', 'date'],
    appendUtm: false,
    supportsConversionWebhook: true,
  },
  travelpayouts: {
    id: 'travelpayouts',
    name: 'Travelpayouts',
    verticals: ['multi', 'flights', 'hotels', 'activities', 'insurance', 'esim', 'cars'],
    defaultItemType: 'activity',
    allowedHosts: [
      'tp.media',
      'tp.st',
      'travelpayouts.com',
      'www.travelpayouts.com',
      'aviasales.com',
      'www.aviasales.com',
    ],
    subIdParam: 'sub_id',
    preservedParams: ['marker', 'trs', 'p', 'shmarker', 'u', 'campaign_id'],
    appendUtm: false,
    supportsConversionWebhook: true,
  },
  stay22: {
    id: 'stay22',
    name: 'Stay22',
    verticals: ['hotels'],
    defaultItemType: 'hotel',
    allowedHosts: ['stay22.com', 'www.stay22.com'],
    subIdParam: 'campaign',
    preservedParams: ['aid', 'address', 'lat', 'lng', 'checkin', 'checkout', 'adults', 'children', 'rooms'],
    appendUtm: false,
    supportsConversionWebhook: true,
  },
  booking: {
    id: 'booking',
    name: 'Booking.com',
    verticals: ['hotels'],
    defaultItemType: 'hotel',
    allowedHosts: ['booking.com', 'www.booking.com'],
    subIdParam: 'label',
    preservedParams: ['aid', 'checkin', 'checkout', 'group_adults', 'group_children', 'no_rooms', 'ss'],
    appendUtm: false,
    supportsConversionWebhook: false,
  },
  expedia: {
    id: 'expedia',
    name: 'Expedia',
    verticals: ['hotels', 'flights', 'cars'],
    defaultItemType: 'hotel',
    allowedHosts: ['expedia.com', 'www.expedia.com'],
    subIdParam: 'affcid',
    preservedParams: ['affcid', 'afflid', 'camref', 'pubref'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  safetywing: {
    id: 'safetywing',
    name: 'SafetyWing',
    verticals: ['insurance'],
    defaultItemType: 'activity',
    allowedHosts: ['safetywing.com', 'www.safetywing.com'],
    subIdParam: 'referenceID',
    preservedParams: ['referenceID', 'ambassador'],
    appendUtm: true,
    supportsConversionWebhook: true,
  },
  airalo: {
    id: 'airalo',
    name: 'Airalo',
    verticals: ['esim'],
    defaultItemType: 'activity',
    allowedHosts: ['airalo.com', 'www.airalo.com'],
    subIdParam: 'sub_id',
    preservedParams: ['ref', 'irclickid'],
    appendUtm: true,
    supportsConversionWebhook: true,
  },
  klook: {
    id: 'klook',
    name: 'Klook',
    verticals: ['activities', 'esim', 'cars'],
    defaultItemType: 'activity',
    allowedHosts: ['klook.com', 'www.klook.com'],
    subIdParam: 'sub_id',
    preservedParams: ['aid', 'aff_adid', 'k_source'],
    appendUtm: true,
    supportsConversionWebhook: true,
  },
  discovercars: {
    id: 'discovercars',
    name: 'DiscoverCars',
    verticals: ['cars'],
    defaultItemType: 'transport',
    allowedHosts: ['discovercars.com', 'www.discovercars.com'],
    subIdParam: 'sub_id',
    preservedParams: ['a_aid', 'a_bid'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  hostelworld: {
    id: 'hostelworld',
    name: 'Hostelworld',
    verticals: ['hotels'],
    defaultItemType: 'hotel',
    allowedHosts: ['hostelworld.com', 'www.hostelworld.com'],
    subIdParam: 'sub_id',
    preservedParams: ['source'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  duffel: {
    id: 'duffel',
    name: 'Duffel',
    verticals: ['flights'],
    defaultItemType: 'transport',
    allowedHosts: ['duffel.com', 'www.duffel.com', 'book.duffel.com', 'links.duffel.com'],
    subIdParam: 'click_id',
    preservedParams: ['reference'],
    appendUtm: true,
    supportsConversionWebhook: true,
  },
  tripadvisor: {
    id: 'tripadvisor',
    name: 'Tripadvisor',
    verticals: ['activities', 'hotels', 'dining'],
    defaultItemType: 'activity',
    allowedHosts: ['tripadvisor.com', 'www.tripadvisor.com'],
    subIdParam: 'sub_id',
    preservedParams: ['m'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  opentable: {
    id: 'opentable',
    name: 'OpenTable',
    verticals: ['dining'],
    defaultItemType: 'restaurant',
    allowedHosts: ['opentable.com', 'www.opentable.com'],
    subIdParam: 'sub_id',
    preservedParams: ['rid', 'restref', 'aid'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  skyscanner: {
    id: 'skyscanner',
    name: 'Skyscanner',
    verticals: ['flights', 'cars', 'hotels'],
    defaultItemType: 'flight',
    allowedHosts: ['skyscanner.com', 'www.skyscanner.com', 'skyscanner.net', 'www.skyscanner.net'],
    subIdParam: 'sub_id',
    preservedParams: ['associateid', 'irclickid'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  ivisa: {
    id: 'ivisa',
    name: 'iVisa',
    verticals: ['visas'],
    defaultItemType: 'activity',
    allowedHosts: ['ivisa.com', 'www.ivisa.com'],
    subIdParam: 'sub_id',
    preservedParams: ['affid', 'irclickid'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
  wise: {
    id: 'wise',
    name: 'Wise',
    verticals: ['finance'],
    defaultItemType: 'activity',
    allowedHosts: ['wise.com', 'www.wise.com'],
    subIdParam: 'sub_id',
    preservedParams: ['irclickid', 'source', 'target'],
    appendUtm: true,
    supportsConversionWebhook: false,
  },
};

export const ALLOWED_AFFILIATE_DOMAINS: readonly string[] = Array.from(
  new Set(AFFILIATE_PARTNER_IDS.flatMap((id) => AFFILIATE_PARTNERS[id].allowedHosts))
);

const PARTNER_ALIAS_MAP: Record<string, AffiliatePartnerId> = {
  viator: 'viator',
  getyourguide: 'getyourguide',
  gyg: 'getyourguide',
  travelpayouts: 'travelpayouts',
  tp: 'travelpayouts',
  aviasales: 'travelpayouts',
  stay22: 'stay22',
  booking: 'booking',
  bookingcom: 'booking',
  expedia: 'expedia',
  safetywing: 'safetywing',
  airalo: 'airalo',
  klook: 'klook',
  discovercars: 'discovercars',
  hostelworld: 'hostelworld',
  duffel: 'duffel',
  tripadvisor: 'tripadvisor',
  opentable: 'opentable',
  skyscanner: 'skyscanner',
  ivisa: 'ivisa',
  wise: 'wise',
};

export function normalizeAffiliatePartner(partner: unknown): AffiliatePartnerId | undefined {
  if (typeof partner !== 'string') return undefined;
  const key = partner.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return key && Object.hasOwn(PARTNER_ALIAS_MAP, key) ? PARTNER_ALIAS_MAP[key] : undefined;
}

export function formatAffiliatePartnerName(partner: string): string {
  const id = normalizeAffiliatePartner(partner);
  return id ? AFFILIATE_PARTNERS[id].name : partner;
}

export function itemTypeForAffiliatePartner(partner: string): AffiliateClickItemType {
  const id = normalizeAffiliatePartner(partner);
  return id ? AFFILIATE_PARTNERS[id].defaultItemType : 'activity';
}

function parseSafeHttpsUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (!host) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedAffiliateUrl(url: string): boolean {
  const parsed = parseSafeHttpsUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_AFFILIATE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

export function resolveAffiliatePartnerByUrl(url: string): AffiliatePartnerId | undefined {
  const parsed = parseSafeHttpsUrl(url);
  if (!parsed) return undefined;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  for (const id of AFFILIATE_PARTNER_IDS) {
    const hosts = AFFILIATE_PARTNERS[id].allowedHosts;
    if (hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return id;
    }
  }
  return undefined;
}

export function injectAffiliateSubId(
  url: string,
  partner: string,
  clickId: string,
  options?: { itemType?: string }
): string | null {
  if (typeof clickId !== 'string' || !clickId.trim()) return null;
  const cleanClickId = clickId.trim();

  const parsed = parseSafeHttpsUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isAllowed = ALLOWED_AFFILIATE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
  if (!isAllowed) return null;

  const urlPartner = resolveAffiliatePartnerByUrl(url);
  const targetId: AffiliatePartnerId | undefined =
    urlPartner ?? normalizeAffiliatePartner(partner);

  if (!targetId) {
    parsed.searchParams.set('click_id', cleanClickId);
    return parsed.toString();
  }

  const meta = AFFILIATE_PARTNERS[targetId];
  const subParam = meta.subIdParam;
  const shouldPreserveExistingSubParam =
    meta.preservedParams.includes(subParam) && parsed.searchParams.has(subParam);

  if (shouldPreserveExistingSubParam) {
    parsed.searchParams.set('click_id', cleanClickId);
  } else {
    parsed.searchParams.set(subParam, cleanClickId);
  }

  if (meta.appendUtm) {
    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', 'faroway');
    }
    if (!parsed.searchParams.has('utm_medium')) {
      parsed.searchParams.set('utm_medium', 'affiliate');
    }
    if (options?.itemType && !parsed.searchParams.has('utm_campaign')) {
      parsed.searchParams.set('utm_campaign', options.itemType);
    }
  }

  return parsed.toString();
}
