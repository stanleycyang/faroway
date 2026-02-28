export type VisaStatus =
  | "visa-free"
  | "visa-on-arrival"
  | "e-visa"
  | "visa-required";

export interface VisaInfo {
  status: VisaStatus;
  duration: string;
  notes?: string;
}

export interface PassportCountry {
  code: string;
  name: string;
  flag: string;
}

export const passportCountries: PassportCountry[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "EU", name: "EU / Schengen", flag: "🇪🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
];

// Matrix: passportCountryCode → destinationSlug → VisaInfo
const visaMatrix: Record<string, Record<string, VisaInfo>> = {
  US: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver for US citizens",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "90 days",
      notes: "Visa on arrival at no cost",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required for US citizens",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA (Electronic Travel Authority) required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for US citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver for US citizens",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "K-ETA required — apply online before travel",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for US citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for US citizens",
    },
    "rio-de-janeiro": {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for US citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for US citizens",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  GB: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    london: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required for UK citizens",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA (Electronic Travel Authority) required",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UK citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "K-ETA required — apply online before travel",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    istanbul: {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed — Common Travel Area with UK",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Post-Brexit: 90 days in any 180-day period in Schengen",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for UK citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UK citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UK citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for UK citizens",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  CA: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Canadian citizens",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Canadian citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "K-ETA required — apply online before travel",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Canadian citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Canadian citizens",
    },
    "rio-de-janeiro": {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Canadian citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  AU: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Australian citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "K-ETA required — apply online before travel",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Australian citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Australian citizens",
    },
    "rio-de-janeiro": {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "Reciprocity fee may apply — check before travel",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Special Category Visa (subclass 444) on arrival",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  EU: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver for EU citizens",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    barcelona: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    santorini: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "Post-Brexit: no visa needed for short stays",
    },
    rome: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    lisbon: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    reykjavik: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EEA freedom of movement",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required for EU citizens",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for EU citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver for EU citizens",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "K-ETA required — apply online before travel",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    istanbul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for most EU citizens",
    },
    prague: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    vienna: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    dublin: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    copenhagen: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    interlaken: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    ibiza: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    chamonix: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "EU freedom of movement",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for EU citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for EU citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for EU citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  IN: {
    tokyo: {
      status: "visa-required",
      duration: "15-90 days",
      notes: "Must apply at Japanese embassy in advance",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-on-arrival",
      duration: "15 days",
      notes: "VOA available or apply for 60-day visa",
    },
    dubai: {
      status: "visa-on-arrival",
      duration: "14 days",
      notes: "14-day visa on arrival available",
    },
    paris: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    barcelona: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    santorini: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    london: {
      status: "visa-required",
      duration: "180 days",
      notes: "Standard Visitor visa required",
    },
    rome: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    lisbon: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    reykjavik: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    "new-york": {
      status: "visa-required",
      duration: "180 days",
      notes: "B1/B2 visa required — apply at US embassy",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required for Indian citizens",
    },
    "cape-town": {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    sydney: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa (subclass 600) required",
    },
    singapore: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for Indian citizens",
    },
    kyoto: {
      status: "visa-required",
      duration: "15-90 days",
      notes: "Must apply at Japanese embassy in advance",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-on-arrival",
      duration: "15 days",
      notes: "VOA available or apply for 60-day visa",
    },
    seoul: {
      status: "visa-required",
      duration: "90 days",
      notes: "Must apply at Korean embassy in advance",
    },
    jaipur: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    istanbul: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    vienna: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    dublin: {
      status: "visa-required",
      duration: "90 days",
      notes: "Irish visa required — apply at embassy",
    },
    copenhagen: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    interlaken: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    "amalfi-coast": {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    ibiza: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    chamonix: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    cancun: {
      status: "visa-required",
      duration: "180 days",
      notes: "Mexican visa required — apply at embassy",
    },
    "rio-de-janeiro": {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    "costa-rica": {
      status: "visa-required",
      duration: "30 days",
      notes: "Tourist visa required — apply at embassy",
    },
    "buenos-aires": {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-required",
      duration: "180 days",
      notes: "Visitor visa required — apply at Canadian embassy",
    },
    cairo: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at airport",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa required — apply online",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  CN: {
    tokyo: {
      status: "visa-required",
      duration: "15-30 days",
      notes: "Must apply at Japanese embassy in advance",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Temporary visa exemption for Chinese tourists",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    barcelona: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    santorini: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    london: {
      status: "visa-required",
      duration: "180 days",
      notes: "Standard Visitor visa required",
    },
    rome: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    lisbon: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    reykjavik: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    "new-york": {
      status: "visa-required",
      duration: "10 years (multi-entry)",
      notes: "B1/B2 visa required — apply at US embassy",
    },
    marrakech: {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    "cape-town": {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    sydney: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa (subclass 600) required",
    },
    singapore: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for Chinese citizens",
    },
    kyoto: {
      status: "visa-required",
      duration: "15-30 days",
      notes: "Must apply at Japanese embassy in advance",
    },
    hanoi: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for Chinese citizens",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Temporary visa exemption for Chinese tourists",
    },
    seoul: {
      status: "visa-required",
      duration: "90 days",
      notes: "Must apply at Korean embassy in advance",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    istanbul: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    vienna: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    dublin: {
      status: "visa-required",
      duration: "90 days",
      notes: "Irish visa required — apply at embassy",
    },
    copenhagen: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    interlaken: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    "amalfi-coast": {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    ibiza: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    chamonix: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    cancun: {
      status: "visa-required",
      duration: "180 days",
      notes: "Mexican visa required — apply at embassy",
    },
    "rio-de-janeiro": {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    "costa-rica": {
      status: "visa-required",
      duration: "30 days",
      notes: "Tourist visa required — apply at embassy",
    },
    "buenos-aires": {
      status: "visa-required",
      duration: "90 days",
      notes: "Tourist visa required — apply at embassy",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-required",
      duration: "180 days",
      notes: "Visitor visa required — apply at Canadian embassy",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa required — apply online",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  JP: {
    tokyo: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    bali: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for Japanese citizens",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Japanese citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Japanese citizens",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Japanese citizens",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Japanese citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Japanese citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Japanese citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Japanese citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  KR: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for Korean citizens",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa for stays under 30 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Korean citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Korean citizens",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Korean citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Korean citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Korean citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Korean citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  BR: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism (as of 2024)",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "visa-free",
      duration: "180 days",
      notes: "Visa exemption for Brazilian citizens",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa (subclass 600) required",
    },
    singapore: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for Brazilian citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Brazilian citizens",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Brazilian citizens",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Brazilian citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Brazilian citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed — Mercosur agreement",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-required",
      duration: "180 days",
      notes: "Visitor visa required — apply at Canadian embassy",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  MX: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-required",
      duration: "180 days",
      notes: "Standard Visitor visa required",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "visa-required",
      duration: "180 days",
      notes: "B1/B2 visa required — apply at US embassy",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for Mexican citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Mexican citizens",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-required",
      duration: "90 days",
      notes: "Irish visa required — apply at embassy",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Mexican citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Mexican citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-required",
      duration: "180 days",
      notes: "Visitor visa required — apply at Canadian embassy",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  ZA: {
    tokyo: {
      status: "visa-required",
      duration: "90 days",
      notes: "Must apply at Japanese embassy in advance",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    barcelona: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    santorini: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    london: {
      status: "visa-required",
      duration: "180 days",
      notes: "Standard Visitor visa required",
    },
    rome: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    lisbon: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    reykjavik: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    "new-york": {
      status: "visa-required",
      duration: "180 days",
      notes: "B1/B2 visa required — apply at US embassy",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required for SA citizens",
    },
    "cape-town": {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    sydney: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa (subclass 600) required",
    },
    singapore: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for SA citizens",
    },
    kyoto: {
      status: "visa-required",
      duration: "90 days",
      notes: "Must apply at Japanese embassy in advance",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-required",
      duration: "90 days",
      notes: "Must apply at Korean embassy in advance",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    istanbul: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    vienna: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    dublin: {
      status: "visa-required",
      duration: "90 days",
      notes: "Irish visa required — apply at embassy",
    },
    copenhagen: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    interlaken: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    "amalfi-coast": {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    ibiza: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    chamonix: {
      status: "visa-required",
      duration: "90 days",
      notes: "Schengen visa required — apply at embassy",
    },
    cancun: {
      status: "visa-required",
      duration: "180 days",
      notes: "Mexican visa required — apply at embassy",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for SA citizens",
    },
    "costa-rica": {
      status: "visa-required",
      duration: "30 days",
      notes: "Tourist visa required — apply at embassy",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for SA citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "visa-required",
      duration: "180 days",
      notes: "Visitor visa required — apply at Canadian embassy",
    },
    cairo: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at airport",
    },
    zanzibar: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed — African Union member",
    },
    queenstown: {
      status: "visa-required",
      duration: "90 days",
      notes: "Visitor visa required — apply online",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  NZ: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Special Category Visa (subclass 444) on arrival",
    },
    singapore: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for NZ citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "K-ETA required — apply online before travel",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "e-visa",
      duration: "90 days",
      notes: "e-Visa required — apply online before travel",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for NZ citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for NZ citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for NZ citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for NZ citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  SG: {
    tokyo: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for Singaporean citizens",
    },
    bangkok: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    dubai: {
      status: "visa-free",
      duration: "30 days",
      notes: "Free visa on arrival",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "e-visa",
      duration: "90 days",
      notes: "ESTA required — apply online before travel",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa for stays under 30 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    kyoto: {
      status: "visa-free",
      duration: "90 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-free",
      duration: "30 days",
      notes: "Visa exemption for tourism",
    },
    seoul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Singaporean citizens",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Visa on arrival available at border",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Singaporean citizens",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Singaporean citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for Singaporean citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Singaporean citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for Singaporean citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Visa required — apply online before travel",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
  AE: {
    tokyo: {
      status: "visa-free",
      duration: "30 days",
      notes: "Tourist visa waiver",
    },
    bali: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "VOA available at airport for $35 USD",
    },
    bangkok: {
      status: "visa-on-arrival",
      duration: "15 days",
      notes: "VOA available at airport",
    },
    dubai: {
      status: "visa-free",
      duration: "Unlimited",
      notes: "Domestic travel — no visa needed",
    },
    paris: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    barcelona: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    santorini: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    london: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for tourism",
    },
    rome: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    lisbon: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    reykjavik: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "new-york": {
      status: "visa-required",
      duration: "180 days",
      notes: "B1/B2 visa required — apply at US embassy",
    },
    marrakech: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa required",
    },
    "cape-town": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa for stays under 90 days",
    },
    sydney: {
      status: "e-visa",
      duration: "90 days",
      notes: "ETA required — apply online",
    },
    singapore: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for UAE citizens",
    },
    kyoto: {
      status: "visa-free",
      duration: "30 days",
      notes: "Tourist visa waiver",
    },
    hanoi: {
      status: "e-visa",
      duration: "90 days",
      notes: "E-visa required — apply online before travel",
    },
    phuket: {
      status: "visa-on-arrival",
      duration: "15 days",
      notes: "VOA available at airport",
    },
    seoul: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for UAE citizens",
    },
    jaipur: {
      status: "e-visa",
      duration: "30 days",
      notes: "e-Tourist visa required — apply online",
    },
    petra: {
      status: "visa-free",
      duration: "30 days",
      notes: "No visa needed for UAE citizens",
    },
    amsterdam: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    istanbul: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UAE citizens",
    },
    prague: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    vienna: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    dublin: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UAE citizens",
    },
    copenhagen: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    interlaken: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    "amalfi-coast": {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    ibiza: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    chamonix: {
      status: "visa-free",
      duration: "90 days",
      notes: "Schengen zone — 90 days in any 180-day period",
    },
    cancun: {
      status: "visa-free",
      duration: "180 days",
      notes: "No visa needed for UAE citizens",
    },
    "rio-de-janeiro": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UAE citizens",
    },
    "costa-rica": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for stays under 90 days",
    },
    "buenos-aires": {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UAE citizens",
    },
    havana: {
      status: "e-visa",
      duration: "30 days",
      notes: "Tourist card required — purchase before travel",
    },
    vancouver: {
      status: "e-visa",
      duration: "180 days",
      notes: "eTA required — apply online before travel",
    },
    cairo: {
      status: "visa-free",
      duration: "90 days",
      notes: "No visa needed for UAE citizens",
    },
    zanzibar: {
      status: "visa-on-arrival",
      duration: "90 days",
      notes: "Visa on arrival available at airport",
    },
    queenstown: {
      status: "e-visa",
      duration: "90 days",
      notes: "NZeTA required — apply online before travel",
    },
    maldives: {
      status: "visa-on-arrival",
      duration: "30 days",
      notes: "Free visa on arrival for all nationalities",
    },
  },
};

export function getVisaInfo(
  passportCode: string,
  destinationSlug: string,
): VisaInfo | undefined {
  return visaMatrix[passportCode]?.[destinationSlug];
}

export function getVisaInfoForDestination(
  destinationSlug: string,
): { passport: PassportCountry; visa: VisaInfo }[] {
  return passportCountries
    .map((passport) => {
      const visa = visaMatrix[passport.code]?.[destinationSlug];
      return visa ? { passport, visa } : null;
    })
    .filter(
      (entry): entry is { passport: PassportCountry; visa: VisaInfo } =>
        entry !== null,
    );
}

export function getVisaSummary(
  destinationSlug: string,
): Record<VisaStatus, number> {
  const counts: Record<VisaStatus, number> = {
    "visa-free": 0,
    "visa-on-arrival": 0,
    "e-visa": 0,
    "visa-required": 0,
  };
  for (const passport of passportCountries) {
    const visa = visaMatrix[passport.code]?.[destinationSlug];
    if (visa) counts[visa.status]++;
  }
  return counts;
}

export const visaStatusConfig: Record<
  VisaStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  "visa-free": {
    label: "Visa Free",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  "visa-on-arrival": {
    label: "Visa on Arrival",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  "e-visa": {
    label: "e-Visa Required",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  "visa-required": {
    label: "Visa Required",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};
