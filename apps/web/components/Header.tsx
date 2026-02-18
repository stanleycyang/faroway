'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from './Button';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <nav aria-label="Main navigation" className="container mx-auto px-6 py-4 flex items-center justify-between max-w-7xl">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="relative w-10 h-10">
            <Image
              src="/icon.png"
              alt="TripGenie Logo"
              width={40}
              height={40}
              className="rounded-xl"
            />
          </div>
          <span className="text-2xl font-bold text-gray-900">TripGenie</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <Link href="#features" className="text-gray-700 hover:text-primary transition-colors font-medium">
            Features
          </Link>
          <Link href="#destinations" className="text-gray-700 hover:text-primary transition-colors font-medium">
            Destinations
          </Link>
          <Link href="#how-it-works" className="text-gray-700 hover:text-primary transition-colors font-medium">
            How It Works
          </Link>
          <Link href="https://apps.apple.com/app/tripgenie" className="text-primary hover:text-primary-600 transition-colors font-medium flex items-center gap-1">
            📱 Get the App
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-gray-700 hover:text-[#ec7a1c] transition-colors font-medium hidden md:block">
            Sign In
          </Link>
          <Button size="md" onClick={() => window.location.href = '/create'}>
            Get Started
          </Button>
        </div>
      </nav>
    </header>
  );
}
