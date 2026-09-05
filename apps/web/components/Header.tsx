"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Destinations", href: "/destinations" },
  { label: "Tools", href: "/tools" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-2xl border-b border-slate-200/60 shadow-sm"
          : "bg-white/50 backdrop-blur-md"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Logo size="md" variant="dark" />

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-4 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Link
              href="/create"
              className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              Plan My Trip
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-navigation"
            className="lg:hidden pb-4 border-t border-slate-200"
          >
            <div className="flex flex-col gap-1 pt-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/create"
                onClick={() => setMobileMenuOpen(false)}
                className="mx-4 mt-2 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary/25"
              >
                <Sparkles className="w-4 h-4" />
                Plan My Trip
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
