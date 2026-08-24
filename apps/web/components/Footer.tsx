import React from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { AppStoreButtons } from "./AppStoreButtons";

export function Footer() {
  return (
    <footer className="bg-surface-950 border-t border-white/[0.04] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <Logo size="md" variant="light" asLink={true} />
            </div>
            <p className="text-surface-400 text-sm mb-4 leading-relaxed">
              AI-powered travel planning with day-by-day itineraries and partner
              options from one place.
            </p>
            <AppStoreButtons />
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4 text-surface-200">Product</h3>
            <ul className="space-y-2.5 text-sm text-surface-400">
              <li>
                <Link
                  href="/destinations"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Destinations
                </Link>
              </li>
              <li>
                <Link
                  href="/tools"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Travel Tools
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/travel-quiz"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Destination Quiz
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/packing-list"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Packing List
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/trip-cost"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Cost Estimator
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/visa-checker"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Visa Checker
                </Link>
              </li>
              <li>
                <Link
                  href="/create"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Start Planning
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4 text-surface-200">Company</h3>
            <ul className="space-y-2.5 text-sm text-surface-400">
              <li>
                <Link
                  href="/about"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/guides"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Travel Guides
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-surface-200">Legal</h3>
            <ul className="space-y-2.5 text-sm text-surface-400">
              <li>
                <Link
                  href="/privacy"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  prefetch={false}
                  className="hover:text-primary-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-surface-400 text-sm">
            © {new Date().getFullYear()} Faroway. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-surface-400">
            <Link
              href="/support"
              prefetch={false}
              className="hover:text-primary-400 transition-colors"
            >
              Support
            </Link>
            <Link
              href="/privacy"
              prefetch={false}
              className="hover:text-primary-400 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              prefetch={false}
              className="hover:text-primary-400 transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
