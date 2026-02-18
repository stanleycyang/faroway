import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FAQAccordion } from '@/components/support/FAQAccordion';
import { Rocket, User, Map, CreditCard, Mail, Download } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Support & Contact | TripGenie',
  description:
    'Get help with TripGenie. Browse FAQs, contact support, or report an issue.',
  alternates: {
    canonical: '/support',
  },
};

const faqItems = [
  {
    question: 'Is TripGenie really free?',
    answer:
      'Yes! TripGenie is completely free to use for trip planning. We earn a small commission when you book hotels or activities through our affiliate links with Booking.com and Viator. This has no additional cost to you.',
  },
  {
    question: 'How does AI trip planning work?',
    answer:
      'Simply enter your destination, travel dates, and preferences (like travel style and interests). Our AI analyzes thousands of data points to create a personalized day-by-day itinerary with activities, restaurants, and local tips tailored to your interests.',
  },
  {
    question: 'Can I edit my itinerary after it\'s generated?',
    answer:
      'Absolutely! Every generated itinerary is fully editable. You can add, remove, or rearrange activities, change restaurants, adjust timing, and customize every detail to make it perfect for your trip.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'You can delete your account by going to Settings \u2192 Account \u2192 Delete Account in the mobile app. Your personal data will be removed within 30 days of deletion. If you need help, contact us at support@tripgenie.ai.',
  },
  {
    question: 'Does the app work offline?',
    answer:
      'Yes! TripGenie uses an offline-first architecture. Your trip itineraries are stored locally on your device so you can access them without an internet connection. Changes sync automatically when you\'re back online.',
  },
  {
    question: 'What data do you collect?',
    answer:
      'We collect your account information (email, name), travel preferences, trip data, and basic usage analytics. We never sell your personal data. For full details, please read our Privacy Policy at tripgenie.ai/privacy.',
  },
  {
    question: 'How are bookings handled?',
    answer:
      'TripGenie provides affiliate links to trusted booking providers like Booking.com for hotels and Viator for tours and activities. When you book through these links, you deal directly with the provider. All pricing, availability, and customer service is handled by the booking provider.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. We use Supabase for secure cloud storage with encryption in transit (TLS) and at rest. On mobile, sensitive tokens are stored using Expo SecureStore. We conduct regular security reviews to protect your data.',
  },
];

const quickHelpCards = [
  {
    icon: Rocket,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Getting Started',
    description:
      'Learn how to create your first AI-powered trip itinerary in seconds.',
  },
  {
    icon: User,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    title: 'Account & Login',
    description:
      'Help with signing in, OAuth providers, password reset, and account settings.',
  },
  {
    icon: Map,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    title: 'Trip Planning',
    description:
      'How AI generation works, editing itineraries, saving and sharing trips.',
  },
  {
    icon: CreditCard,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    title: 'Bookings',
    description:
      'Affiliate bookings through Booking.com and Viator. Pricing and refunds handled by providers.',
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="pt-24">
        {/* Hero Section */}
        <section className="pt-12 pb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            How can we help?
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto px-6">
            Find answers to common questions or reach out to our support team.
          </p>
        </section>

        {/* Quick Help Cards */}
        <section className="max-w-4xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-4 mb-16">
            {quickHelpCards.map((card) => (
              <div
                key={card.title}
                className="p-6 bg-white rounded-2xl border border-gray-200 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div
                  className={`w-12 h-12 ${card.iconBg} ${card.iconColor} rounded-xl flex items-center justify-center mb-4`}
                >
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto px-6 mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <FAQAccordion items={faqItems} />
        </section>

        {/* Contact Section */}
        <section className="max-w-4xl mx-auto px-6 mb-16">
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Still need help?
            </h2>
            <p className="text-gray-600">
              Our support team is here to help. Send us an email and we&apos;ll
              get back to you within 24 hours.
            </p>
            <a
              href="mailto:support@tripgenie.ai"
              className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-primary hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors"
            >
              <Mail className="w-5 h-5" />
              support@tripgenie.ai
            </a>
          </div>
        </section>

        {/* App Download CTA */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-gradient-to-r from-primary to-primary-600 rounded-2xl p-8 text-center text-white">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <Download className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              Get the best experience on mobile
            </h2>
            <p className="text-white/80 mb-6">
              Download TripGenie for offline access, GPS navigation, and
              real-time trip updates.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://apps.apple.com/app/tripgenie"
                className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 px-5 py-3 rounded-xl text-sm font-medium text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.tripgenie"
                className="inline-flex items-center gap-2 bg-black hover:bg-gray-900 px-5 py-3 rounded-xl text-sm font-medium text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                Google Play
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
