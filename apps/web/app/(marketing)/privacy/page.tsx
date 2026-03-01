import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Faroway",
  description:
    "Learn how Faroway collects, uses, and protects your personal information.",
  alternates: {
    canonical: "/privacy",
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
              Last updated: February 18, 2026
            </p>
          </div>

          <div className="prose prose-lg prose-gray prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary-600 prose-a:underline-offset-2">
            {/* 1. Introduction */}
            <h2>1. Introduction</h2>
            <p>
              Faroway (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              operates the website at{" "}
              <a
                href="https://faroway.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                faroway.ai
              </a>{" "}
              and the Faroway mobile application (iOS and Android, bundle
              identifier: <code>ai.faroway.app</code>), collectively referred to
              as the &ldquo;Service.&rdquo;
            </p>
            <p>
              This Privacy Policy explains what information we collect, how we
              use it, who we share it with, and what rights you have regarding
              your data. By using the Service, you agree to the collection and
              use of information as described in this policy. This policy is
              incorporated into and subject to our{" "}
              <Link href="/terms">Terms of Service</Link>.
            </p>

            {/* 2. Information We Collect */}
            <h2>2. Information We Collect</h2>

            <h3>2.1 Information You Provide</h3>
            <ul>
              <li>
                <strong>Account information</strong> &mdash; name and email
                address provided through OAuth providers (Apple Sign-In, Google
                Sign-In) or direct email registration.
              </li>
              <li>
                <strong>Travel preferences</strong> &mdash; selected travel
                vibes, traveler type, budget preferences, and other planning
                inputs.
              </li>
              <li>
                <strong>Trip data</strong> &mdash; destinations, dates,
                itineraries, notes, and other trip-related content you create or
                save.
              </li>
              <li>
                <strong>Communications</strong> &mdash; messages you send to our
                support team.
              </li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li>
                <strong>Usage data</strong> &mdash; pages visited, features
                used, buttons clicked, search queries, and interactions within
                the Service.
              </li>
              <li>
                <strong>Device information</strong> &mdash; operating system,
                browser type and version, device type, screen resolution, and
                unique device identifiers.
              </li>
              <li>
                <strong>Log data</strong> &mdash; IP address, access times,
                referring URLs, and error logs.
              </li>
              <li>
                <strong>Location data</strong> &mdash; approximate location
                derived from your IP address. Precise location data (GPS) is
                collected only with your explicit permission on mobile devices
                and used solely for nearby recommendations.
              </li>
              <li>
                <strong>Push notification tokens</strong> &mdash; device tokens
                for delivering push notifications, collected only if you opt in
                to notifications on the mobile app.
              </li>
            </ul>

            <h3>2.3 Affiliate &amp; Booking Interaction Data</h3>
            <p>
              When you interact with affiliate links or booking options within
              the Service, we collect:
            </p>
            <ul>
              <li>
                <strong>Click data</strong> &mdash; which affiliate links you
                click, the time and context of the click (e.g., which itinerary
                and activity it relates to).
              </li>
              <li>
                <strong>Conversion data</strong> &mdash; whether a click
                resulted in a completed booking on the third-party
                provider&apos;s site. We receive limited conversion information
                from our affiliate partners (typically a confirmation that a
                booking occurred and the commission amount, but <em>not</em> the
                full details of your booking such as payment information).
              </li>
              <li>
                <strong>Referral identifiers</strong> &mdash; unique tracking
                IDs appended to affiliate URLs to attribute referrals. These
                identifiers do not contain your personal information.
              </li>
            </ul>

            {/* 3. Cookies & Tracking Technologies */}
            <h2>3. Cookies &amp; Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies on our website to provide,
              protect, and improve the Service:
            </p>
            <ul>
              <li>
                <strong>Essential cookies</strong> &mdash; required for the
                Service to function (e.g., session management, authentication
                state). These cannot be disabled.
              </li>
              <li>
                <strong>Analytics cookies</strong> &mdash; help us understand
                how visitors use the Service (e.g., page views, navigation
                patterns). We use privacy-focused analytics.
              </li>
              <li>
                <strong>Affiliate tracking cookies</strong> &mdash; placed by
                our affiliate partners (Booking.com, Viator) when you click an
                affiliate link. These cookies allow the partner to attribute
                your booking to Faroway. These cookies are governed by the
                respective partner&apos;s cookie policy.
              </li>
            </ul>
            <p>
              You can manage cookie preferences through your browser settings.
              Blocking essential cookies may affect the functionality of the
              Service.
            </p>

            {/* 4. How We Use Your Information */}
            <h2>4. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul>
              <li>
                <strong>Service delivery</strong> &mdash; create and manage your
                account, generate AI-powered itineraries, and sync trips across
                devices.
              </li>
              <li>
                <strong>Personalization</strong> &mdash; tailor recommendations
                based on your travel preferences and past activity.
              </li>
              <li>
                <strong>Affiliate services</strong> &mdash; facilitate referrals
                to third-party booking providers and track affiliate commissions
                owed to us.
              </li>
              <li>
                <strong>Communications</strong> &mdash; send trip reminders,
                push notifications (if opted in), and respond to support
                requests.
              </li>
              <li>
                <strong>Improvement</strong> &mdash; analyze usage patterns and
                feedback to improve the Service, AI models, and user experience.
              </li>
              <li>
                <strong>Safety &amp; security</strong> &mdash; detect, prevent,
                and respond to fraud, abuse, and security incidents.
              </li>
              <li>
                <strong>Legal compliance</strong> &mdash; comply with applicable
                laws, regulations, and legal processes.
              </li>
            </ul>

            {/* 5. How We Share Your Information */}
            <h2>5. How We Share Your Information</h2>
            <p>
              We do not sell your personal data. We share information only in
              the following circumstances:
            </p>

            <h3>5.1 Third-Party Service Providers</h3>
            <p>
              We share data with service providers who help us operate the
              Service:
            </p>
            <ul>
              <li>
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase
                </a>{" "}
                &mdash; authentication, database, and data storage.
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Places API
                </a>{" "}
                &mdash; destination search and autocomplete. Your search queries
                are sent to Google.
              </li>
              <li>
                <a
                  href="https://www.apple.com/legal/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple Sign-In
                </a>{" "}
                &mdash; authentication for iOS users.
              </li>
              <li>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Sign-In
                </a>{" "}
                &mdash; authentication for Google users.
              </li>
            </ul>

            <h3>5.2 Affiliate Partners</h3>
            <p>
              When you click an affiliate link, you are directed to a
              third-party provider&apos;s website. At that point, the provider
              may collect your information under their own privacy policy. Our
              affiliate partners include:
            </p>
            <ul>
              <li>
                <a
                  href="https://www.booking.com/content/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Booking.com
                </a>{" "}
                &mdash; hotel and accommodation bookings. When you click a
                Booking.com link, a referral identifier is included in the URL.
                Booking.com may set cookies on your device.
              </li>
              <li>
                <a
                  href="https://www.viator.com/support/privacyPolicy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Viator
                </a>{" "}
                &mdash; tours, activities, and experience bookings. When you
                click a Viator link, a referral identifier is included in the
                URL. Viator may set cookies on your device.
              </li>
            </ul>
            <p>
              We do not share your name, email, or account information with
              affiliate partners. The only data transmitted is the referral
              identifier embedded in the link URL.
            </p>

            <h3>5.3 AI Service Providers</h3>
            <p>
              To generate itineraries, your travel preferences (destination,
              dates, travel vibes, traveler type) are sent to our AI processing
              provider. This data does not include your name, email, or account
              information. We contractually require our AI providers to not use
              your data to train their models.
            </p>

            <h3>5.4 Legal &amp; Safety</h3>
            <p>
              We may disclose your information if required to do so by law, or
              if we believe in good faith that disclosure is necessary to:
            </p>
            <ul>
              <li>
                Comply with legal obligations, subpoenas, or court orders.
              </li>
              <li>
                Protect and defend the rights, property, or safety of Faroway,
                our users, or the public.
              </li>
              <li>
                Detect, prevent, or address fraud, security issues, or technical
                problems.
              </li>
            </ul>

            <h3>5.5 Business Transfers</h3>
            <p>
              If Faroway is involved in a merger, acquisition, asset sale, or
              bankruptcy, your information may be transferred as part of that
              transaction. We will notify you via email or prominent notice on
              the Service before your information is transferred and becomes
              subject to a different privacy policy.
            </p>

            {/* 6. Data Storage & Security */}
            <h2>6. Data Storage &amp; Security</h2>
            <p>
              Your data is stored in the cloud via Supabase with encryption in
              transit (TLS 1.2+) and at rest (AES-256). On mobile devices,
              sensitive tokens (authentication tokens, session data) are stored
              using Expo SecureStore, which utilizes the platform&apos;s secure
              enclave (iOS Keychain / Android Keystore).
            </p>
            <p>
              We implement industry-standard security measures including access
              controls, regular security audits, and monitoring for unauthorized
              access. However, no method of electronic transmission or storage
              is 100% secure. While we strive to protect your personal data, we
              cannot guarantee absolute security.
            </p>

            {/* 7. International Data Transfers */}
            <h2>7. International Data Transfers</h2>
            <p>
              Faroway is based in the United States. If you access the Service
              from outside the United States, your information may be
              transferred to, stored in, and processed in the United States or
              other countries where our service providers operate. These
              countries may have data protection laws that differ from your
              jurisdiction.
            </p>
            <p>
              For transfers from the European Economic Area (EEA), United
              Kingdom, or Switzerland, we rely on Standard Contractual Clauses
              approved by the European Commission, or other legally recognized
              transfer mechanisms, to ensure adequate protection of your
              personal data.
            </p>

            {/* 8. Data Retention */}
            <h2>8. Data Retention</h2>
            <ul>
              <li>
                <strong>Account data</strong> is retained for as long as your
                account remains active.
              </li>
              <li>
                <strong>Trip data</strong> is retained until you choose to
                delete it.
              </li>
              <li>
                <strong>Affiliate click and conversion data</strong> is retained
                for up to 24 months for commission reconciliation and reporting
                purposes, then anonymized or deleted.
              </li>
              <li>
                <strong>Analytics data</strong> is retained in
                anonymized/aggregated form and does not contain personal
                identifiers.
              </li>
              <li>
                <strong>Log data</strong> (IP addresses, error logs) is retained
                for up to 90 days for security and debugging purposes.
              </li>
            </ul>
            <p>
              You can delete your account at any time through the app or website
              settings, or by contacting us at{" "}
              <a href="mailto:support@faroway.ai">support@faroway.ai</a>. Upon
              account deletion, your personal data will be removed from our
              active systems within 30 days. Some data may persist in encrypted
              backups for up to 90 days before being permanently deleted.
            </p>

            {/* 9. Your Rights */}
            <h2>9. Your Rights</h2>
            <p>
              Depending on your jurisdiction, you may have some or all of the
              following rights:
            </p>
            <ul>
              <li>
                <strong>Access</strong> &mdash; request a copy of the personal
                data we hold about you.
              </li>
              <li>
                <strong>Correction</strong> &mdash; request correction of
                inaccurate or incomplete data.
              </li>
              <li>
                <strong>Deletion</strong> &mdash; request deletion of your
                personal data.
              </li>
              <li>
                <strong>Data portability</strong> &mdash; request an export of
                your data in a structured, machine-readable format.
              </li>
              <li>
                <strong>Opt-out of analytics</strong> &mdash; disable analytics
                tracking in your account settings.
              </li>
              <li>
                <strong>Withdraw consent</strong> &mdash; where processing is
                based on consent, you may withdraw it at any time.
              </li>
              <li>
                <strong>Restrict processing</strong> &mdash; request that we
                limit how we use your data.
              </li>
              <li>
                <strong>Object to processing</strong> &mdash; object to
                processing based on legitimate interests.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:privacy@faroway.ai">privacy@faroway.ai</a>. We
              will respond within 30 days (or within the timeframe required by
              applicable law). We may ask you to verify your identity before
              processing your request.
            </p>

            {/* 10. California Residents (CCPA/CPRA) */}
            <h2>10. California Residents (CCPA/CPRA)</h2>
            <p>
              If you are a California resident, the California Consumer Privacy
              Act (CCPA) and California Privacy Rights Act (CPRA) provide you
              with additional rights:
            </p>

            <h3>Categories of Personal Information Collected</h3>
            <ul>
              <li>
                <strong>Identifiers</strong> &mdash; name, email address, IP
                address, device identifiers.
              </li>
              <li>
                <strong>Internet activity</strong> &mdash; browsing history
                within the Service, search history, interaction data.
              </li>
              <li>
                <strong>Geolocation data</strong> &mdash; approximate location
                from IP; precise location only with consent.
              </li>
              <li>
                <strong>Inferences</strong> &mdash; travel preferences and
                interests derived from your usage.
              </li>
            </ul>

            <h3>Your California Rights</h3>
            <ul>
              <li>
                <strong>Right to Know</strong> &mdash; request disclosure of the
                categories and specific pieces of personal information we have
                collected about you.
              </li>
              <li>
                <strong>Right to Delete</strong> &mdash; request deletion of
                your personal information.
              </li>
              <li>
                <strong>Right to Correct</strong> &mdash; request correction of
                inaccurate personal information.
              </li>
              <li>
                <strong>Right to Opt-Out of Sale/Sharing</strong> &mdash; we do{" "}
                <strong>not</strong> sell your personal information. We do not
                share your personal information for cross-context behavioral
                advertising.
              </li>
              <li>
                <strong>Right to Non-Discrimination</strong> &mdash; we will not
                discriminate against you for exercising your privacy rights.
              </li>
            </ul>
            <p>
              To submit a request, email{" "}
              <a href="mailto:privacy@faroway.ai">privacy@faroway.ai</a> with
              the subject line &ldquo;CCPA Request.&rdquo; We will verify your
              identity and respond within 45 days.
            </p>

            {/* 11. EU/EEA Residents (GDPR) */}
            <h2>11. EU/EEA Residents (GDPR)</h2>
            <p>
              If you are located in the European Economic Area, the United
              Kingdom, or Switzerland, the General Data Protection Regulation
              (GDPR) and applicable local laws provide you with additional
              protections.
            </p>

            <h3>Legal Basis for Processing</h3>
            <p>
              We process your personal data under the following legal bases:
            </p>
            <ul>
              <li>
                <strong>Contract performance</strong> &mdash; processing
                necessary to provide the Service you requested (e.g., generating
                itineraries, managing your account).
              </li>
              <li>
                <strong>Legitimate interests</strong> &mdash; processing
                necessary for our legitimate business interests (e.g., improving
                the Service, fraud prevention, analytics), balanced against your
                rights.
              </li>
              <li>
                <strong>Consent</strong> &mdash; processing based on your
                explicit consent (e.g., location data access, push
                notifications, optional marketing communications).
              </li>
              <li>
                <strong>Legal obligation</strong> &mdash; processing necessary
                to comply with applicable laws.
              </li>
            </ul>

            <h3>Your GDPR Rights</h3>
            <p>
              In addition to the rights listed in Section 9, you have the right
              to lodge a complaint with your local data protection supervisory
              authority if you believe we have violated your data protection
              rights.
            </p>

            <h3>Automated Decision-Making</h3>
            <p>
              Our Service uses AI to generate travel itineraries based on your
              inputs (destination, dates, preferences). This processing is
              automated but does not produce legal effects or similarly
              significant effects on you. The AI generates travel suggestions
              only &mdash; you are free to use, modify, or disregard them. No
              automated decisions are made regarding your access to the Service,
              pricing, or eligibility.
            </p>

            {/* 12. Do Not Track */}
            <h2>12. Do Not Track</h2>
            <p>
              Some browsers transmit a &ldquo;Do Not Track&rdquo; (DNT) signal.
              There is currently no industry-standard way to respond to DNT
              signals. We do not currently respond to DNT signals, but we do not
              engage in cross-site tracking of our users.
            </p>

            {/* 13. Children's Privacy */}
            <h2>13. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed at children under 13 (or the
              applicable age of digital consent in your jurisdiction). We do not
              knowingly collect personal information from children under this
              age. If you are a parent or guardian and believe your child has
              provided us with personal information, please contact us at{" "}
              <a href="mailto:privacy@faroway.ai">privacy@faroway.ai</a> and we
              will promptly delete that information.
            </p>

            {/* 14. Changes to This Policy */}
            <h2>14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes via the app, email, or a prominent
              notice on the website at least 30 days before they take effect.
              The &ldquo;Last updated&rdquo; date at the top of this page will
              be revised. Your continued use of the Service after the updated
              policy takes effect constitutes your acceptance. If you do not
              agree to the updated policy, you should stop using the Service and
              delete your account.
            </p>

            {/* 15. Contact Us */}
            <h2>15. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this
              Privacy Policy or your personal data, contact us:
            </p>
            <ul>
              <li>
                Privacy inquiries:{" "}
                <a href="mailto:privacy@faroway.ai">privacy@faroway.ai</a>
              </li>
              <li>
                General support:{" "}
                <a href="mailto:support@faroway.ai">support@faroway.ai</a>
              </li>
              <li>
                Visit our <Link href="/support">Support page</Link>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
