'use client';

import { useState, FormEvent } from 'react';

export function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/blog/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'blog' }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="my-16 rounded-2xl glass-card p-8 md:p-12">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
          Get Travel Tips Delivered Weekly
        </h2>
        <p className="text-slate-600 mb-6">
          Join 25,000+ travelers who get our best tips, destination guides, and exclusive deals straight to their inbox.
        </p>
        {status === 'success' ? (
          <p className="text-primary font-semibold text-lg">You&apos;re in! Check your inbox for a welcome email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-light hover:to-amber-400 text-white font-semibold rounded-xl transition-all whitespace-nowrap disabled:opacity-50"
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe Free'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-sm mt-3">Something went wrong. Please try again.</p>
        )}
        <p className="text-xs text-slate-500 mt-3">No spam, ever. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
