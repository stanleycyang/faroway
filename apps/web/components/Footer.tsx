import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-surface-950 border-t border-white/[0.04] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">Faroway</span>
            </Link>
            <p className="text-surface-400 text-sm mb-4 leading-relaxed">
              Your AI-powered travel genie. Plan your dream trip in seconds, book everything in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://apps.apple.com/app/faroway"
                className="inline-flex items-center gap-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-5 py-3 rounded-2xl font-semibold text-white transition-all backdrop-blur-sm hover:-translate-y-0.5"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] opacity-70">Download on the</div>
                  <div className="text-base leading-tight">App Store</div>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.faroway"
                className="inline-flex items-center gap-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-5 py-3 rounded-2xl font-semibold text-white transition-all backdrop-blur-sm hover:-translate-y-0.5"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] opacity-70">GET IT ON</div>
                  <div className="text-base leading-tight">Google Play</div>
                </div>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4 text-surface-200">Product</h4>
            <ul className="space-y-2.5 text-sm text-surface-400">
              <li><Link href="/destinations" className="hover:text-primary-400 transition-colors">Destinations</Link></li>
              <li><Link href="/tools" className="hover:text-primary-400 transition-colors">Travel Tools</Link></li>
              <li><Link href="/tools/travel-quiz" className="hover:text-primary-400 transition-colors">Destination Quiz</Link></li>
              <li><Link href="/tools/packing-list" className="hover:text-primary-400 transition-colors">Packing List</Link></li>
              <li><Link href="/tools/trip-cost" className="hover:text-primary-400 transition-colors">Cost Estimator</Link></li>
              <li><Link href="/tools/visa-checker" className="hover:text-primary-400 transition-colors">Visa Checker</Link></li>
              <li><Link href="/create" className="hover:text-primary-400 transition-colors">Start Planning</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4 text-surface-200">Company</h4>
            <ul className="space-y-2.5 text-sm text-surface-400">
              <li><Link href="/about" className="hover:text-primary-400 transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-primary-400 transition-colors">Blog</Link></li>
              <li><Link href="/blog/guides" className="hover:text-primary-400 transition-colors">Travel Guides</Link></li>
              <li><Link href="/support" className="hover:text-primary-400 transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4 text-surface-200">Legal</h4>
            <ul className="space-y-2.5 text-sm text-surface-400">
              <li><Link href="/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-surface-500 text-sm">
            © {new Date().getFullYear()} Faroway. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-surface-400">
            <a href="https://twitter.com/faroway" className="hover:text-primary-400 transition-colors">Twitter</a>
            <a href="https://instagram.com/faroway" className="hover:text-primary-400 transition-colors">Instagram</a>
            <a href="https://facebook.com/faroway" className="hover:text-primary-400 transition-colors">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
