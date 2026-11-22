"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useUser } from "@/hooks/useUser";

const NAV_ITEMS = [
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Destinations", href: "/destinations" },
  { label: "Tools", href: "/tools" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
];

export function Header() {
  const { user, loading: authLoading } = useUser();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector?.("a")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header>
      <nav
        aria-label="Main"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-2xl border-b border-slate-200/60 shadow-sm"
            : "bg-white/85 backdrop-blur-md border-b border-slate-200/30"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Logo size="md" variant="dark" />

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

            <div className="flex items-center gap-1 sm:gap-2">
              {!authLoading && user ? (
                <Link
                  href="/dashboard"
                  className="hidden md:inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  My trips
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="hidden md:inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/dashboard"
                    className="hidden lg:inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    My trips
                  </Link>
                </>
              )}
              <Link
                href="/create"
                className="inline-flex min-h-11 items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white px-3.5 sm:px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary-900/20 hover:shadow-primary-900/30 transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span className="sm:hidden">Plan</span>
                <span className="hidden sm:inline">Plan My Trip</span>
              </Link>
              <button
                ref={toggleRef}
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="lg:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <Menu className="w-6 h-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              id="mobile-nav"
              ref={menuRef}
              className="lg:hidden pb-4 border-t border-slate-200"
            >
              <div className="flex flex-col gap-1 pt-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={closeMenu}
                    className="flex min-h-11 items-center px-4 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))}
                {!(!authLoading && user) && (
                  <Link
                    href="/auth/login"
                    onClick={closeMenu}
                    className="flex min-h-11 items-center px-4 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    Sign in
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  onClick={closeMenu}
                  className="flex min-h-11 items-center px-4 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  My trips
                </Link>
                <Link
                  href="/create"
                  onClick={closeMenu}
                  className="mx-4 mt-2 inline-flex min-h-11 items-center justify-center gap-2 bg-primary-700 hover:bg-primary-800 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary-900/20"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Plan My Trip
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
