import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy | TripGenie',
  description:
    'Learn how TripGenie collects, uses, and protects your personal information.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="pt-24">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-lg text-gray-500">
              Last updated: February 17, 2026
            </p>
          </div>

          <div className="prose prose-lg prose-gray prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary-600 prose-a:underline-offset-2">
            {/* 1. Introduction */}
            <h2>Introduction</h2>
            <p>
              Effective date: February 17, 2026.
            </p>
            <p>
              TripGenie (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              operates the website{' '}
              <a href="https://tripgenie.ai" target="_blank" rel="noopener noreferrer">
                tripgenie.ai
              </a>{' '}
              and the TripGenie mobile application (bundle identifier:{' '}
              <code>ai.tripgenie.app</code>). This policy explains how we
              collect, use, and protect your information.
            </p>

            {/* 2. Information We Collect */}
            <h2>Information We Collect</h2>
            <p>
              We may collect the following types of information when you use our
              services:
            </p>
            <ul>
              <li>
                <strong>Account information</strong> &mdash; email address and
                name provided by OAuth providers (such as Apple Sign-In or Google
                Sign-In)
              </li>
              <li>
                <strong>Travel preferences &amp; trip data</strong> &mdash;
                destinations, dates, itineraries, and other trip-related content
                you create
              </li>
              <li>
                <strong>Usage data</strong> &mdash; pages visited, features
                used, and interactions within the app
              </li>
              <li>
                <strong>Device information</strong> &mdash; operating system,
                browser, and device type
              </li>
              <li>
                <strong>Location data</strong> &mdash; collected only with your
                explicit permission and used solely for nearby recommendations
              </li>
            </ul>

            {/* 3. How We Use Your Information */}
            <h2>How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Create and manage your account</li>
              <li>Generate AI-powered itineraries tailored to your preferences</li>
              <li>Sync your trips across devices</li>
              <li>Provide location-based recommendations (with your permission)</li>
              <li>Improve our services and perform analytics</li>
              <li>Communicate with you about your account and trips</li>
            </ul>

            {/* 4. Third-Party Services */}
            <h2>Third-Party Services</h2>
            <p>
              We integrate with the following third-party services, each of which
              has its own privacy policy:
            </p>
            <ul>
              <li>
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase
                </a>{' '}
                &mdash; authentication and data storage
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Places API
                </a>{' '}
                &mdash; location data
              </li>
              <li>
                <a
                  href="https://www.apple.com/legal/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple Sign-In
                </a>{' '}
                &mdash; authentication
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Sign-In
                </a>{' '}
                &mdash; authentication
              </li>
              <li>
                <a
                  href="https://www.booking.com/content/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Booking.com
                </a>{' '}
                &mdash; affiliate hotel bookings
              </li>
              <li>
                <a
                  href="https://www.viator.com/support/privacyPolicy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Viator
                </a>{' '}
                &mdash; affiliate activity bookings
              </li>
            </ul>

            {/* 5. Data Storage & Security */}
            <h2>Data Storage &amp; Security</h2>
            <p>
              Your data is stored in the cloud via Supabase with encryption in
              transit (TLS) and at rest. On mobile devices, sensitive tokens are
              stored securely using Expo SecureStore. We conduct regular security
              reviews to identify and address potential vulnerabilities.
            </p>
            <p>
              No method of electronic transmission or storage is 100% secure.
              While we cannot guarantee absolute security, we strive to use
              commercially acceptable means to protect your personal data.
            </p>

            {/* 6. Data Retention */}
            <h2>Data Retention</h2>
            <p>
              Account data is retained for as long as your account remains
              active. Trip data is retained until you choose to delete it. You
              can delete your account at any time through the app settings. Upon
              account deletion, your personal data will be removed within 30
              days.
            </p>

            {/* 7. Your Rights */}
            <h2>Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Opt out of analytics</li>
            </ul>
            <p>
              <strong>California residents (CCPA):</strong> You have the right to
              know what personal data we collect, request deletion of your data,
              and opt out of the sale of personal data. We do not sell your
              personal data.
            </p>
            <p>
              <strong>EU residents (GDPR):</strong> You have the right to
              access, rectify, erase, restrict processing, data portability, and
              object to processing of your personal data.
            </p>

            {/* 8. Children's Privacy */}
            <h2>Children&apos;s Privacy</h2>
            <p>
              TripGenie is not directed at children under 13. We do not knowingly
              collect personal information from children under 13. If you believe
              we have collected personal information from a child under 13,
              please contact us and we will delete it promptly.
            </p>

            {/* 9. Changes to This Policy */}
            <h2>Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify
              you of any material changes via the app or email. Your continued
              use of TripGenie after changes are posted constitutes your
              acceptance of the updated policy.
            </p>

            {/* 10. Contact Us */}
            <h2>Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy,
              please reach out to us:
            </p>
            <ul>
              <li>
                Email:{' '}
                <a href="mailto:support@tripgenie.ai">support@tripgenie.ai</a>
              </li>
              <li>
                Visit our{' '}
                <Link href="/support">Support page</Link>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
