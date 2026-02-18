'use client';

import { useState, FormEvent } from 'react';

export function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Placeholder — wire up to your email service
    setSubmitted(true);
  };

  return (
    <section className="my-16 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 p-8 md:p-12">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          ✈️ Get Travel Tips Delivered Weekly
        </h2>
        <p className="text-gray-600 mb-6">
          Join 25,000+ travelers who get our best tips, destination guides, and exclusive deals straight to their inbox.
        </p>
        {submitted ? (
          <p className="text-green-600 font-semibold text-lg">🎉 You&apos;re in! Check your inbox for a welcome email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Subscribe Free
            </button>
          </form>
        )}
        <p className="text-xs text-gray-400 mt-3">No spam, ever. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
