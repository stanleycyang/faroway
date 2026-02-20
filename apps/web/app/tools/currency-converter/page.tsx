import type { Metadata } from 'next';
import { CurrencyConverterClient } from '@/components/tools/currency/CurrencyConverterClient';

export const metadata: Metadata = {
  title: 'Currency Converter — Travel Money Calculator',
  description:
    'Convert between 11 travel currencies with approximate rates. Includes destination-specific tips for handling money abroad.',
  alternates: { canonical: '/tools/currency-converter' },
  openGraph: {
    title: 'Currency Converter | TripGenie',
    description: 'Free travel currency converter with tips for 14 destinations.',
    url: '/tools/currency-converter',
  },
};

export default function CurrencyConverterPage() {
  return <CurrencyConverterClient />;
}
