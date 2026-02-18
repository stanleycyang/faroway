'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Users, ChevronDown, ChevronUp, Sparkles, ArrowLeft, Check, Minus, Plus, X } from 'lucide-react';

const destinations = [
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80' },
  { id: 'paris', name: 'Paris', country: 'France', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80' },
  { id: 'new-york', name: 'New York', country: 'USA', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80' },
  { id: 'santorini', name: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80' },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80' },
];

const travelerTypes = [
  { id: 'solo', label: 'Solo', icon: '🧑' },
  { id: 'couple', label: 'Couple', icon: '💑' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'friends', label: 'Friends', icon: '👯' },
  { id: 'business', label: 'Business', icon: '💼' },
];

const vibes = [
  { id: 'adventure', label: 'Adventure', emoji: '🏔️' },
  { id: 'relaxation', label: 'Relaxation', emoji: '🏖️' },
  { id: 'cultural', label: 'Cultural', emoji: '🏛️' },
  { id: 'foodie', label: 'Foodie', emoji: '🍜' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { id: 'romantic', label: 'Romantic', emoji: '💕' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'wellness', label: 'Wellness', emoji: '🧘' },
  { id: 'photography', label: 'Photography', emoji: '📸' },
];

export default function CreateTripPage() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDestinations, setShowDestinations] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [travelerType, setTravelerType] = useState('couple');
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');

  const filteredDestinations = searchQuery
    ? destinations.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : destinations;

  const selectedDest = destinations.find(d => d.name === destination);
  
  const toggleVibe = (vibeId: string) => {
    setSelectedVibes(prev => 
      prev.includes(vibeId) 
        ? prev.filter(v => v !== vibeId)
        : prev.length < 5 ? [...prev, vibeId] : prev
    );
  };

  const canGenerate = destination && startDate && endDate;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerateError(null);
    setProgressMessage('Analyzing your preferences...');
    
    const progressMessages = [
      'Finding the best spots...',
      'Crafting your perfect itinerary...',
      'Adding local recommendations...',
      'Almost there...',
    ];
    let msgIdx = 0;
    const progressInterval = setInterval(() => {
      if (msgIdx < progressMessages.length) {
        setProgressMessage(progressMessages[msgIdx]);
        msgIdx++;
      }
    }, 2500);
    
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          start_date: startDate,
          end_date: endDate,
          travelers,
          preferences: {
            travelerType,
            vibes: selectedVibes,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create trip');
      }

      const { trip } = await response.json();
      clearInterval(progressInterval);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      clearInterval(progressInterval);
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsGenerating(false);
      setProgressMessage('');
    }
  };

  const getTripDuration = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Plan Your Trip</h1>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full ${destination ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${startDate && endDate ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${showAdvanced && (selectedVibes.length > 0 || travelerType) ? 'bg-primary' : 'bg-gray-200'}`} />
        </div>

        {/* Destination Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Where do you want to go?</h2>
              <p className="text-sm text-gray-500">Search or select a destination</p>
            </div>
          </div>

          {selectedDest && !showDestinations ? (
            <div role="button" tabIndex={0} aria-label={`Change destination from ${selectedDest.name}`} onKeyDown={(e) => e.key === 'Enter' && setShowDestinations(true)} className="relative h-48 rounded-xl overflow-hidden group cursor-pointer" onClick={() => setShowDestinations(true)}>
              <Image src={selectedDest.image} alt={`${selectedDest.name}, ${selectedDest.country}`} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-primary-300 text-sm font-medium uppercase tracking-wide">{selectedDest.country}</p>
                <h3 className="text-2xl font-bold text-white">{selectedDest.name}</h3>
              </div>
              <button className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 hover:bg-white transition-colors">
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDestinations(true); }}
                  onFocus={() => setShowDestinations(true)}
                  placeholder="Search cities, countries..."
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {filteredDestinations.map((dest) => (
                  <button
                    key={dest.id}
                    aria-label={`Select ${dest.name}, ${dest.country}`}
                    aria-pressed={destination === dest.name}
                    onClick={() => { setDestination(dest.name); setShowDestinations(false); setSearchQuery(''); }}
                    className={`relative h-32 rounded-xl overflow-hidden group ${destination === dest.name ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <Image src={dest.image} alt={`${dest.name}, ${dest.country}`} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white font-semibold">{dest.name}</p>
                      <p className="text-white/70 text-xs">{dest.country}</p>
                    </div>
                    {destination === dest.name && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Dates Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">When are you traveling?</h2>
              <p className="text-sm text-gray-500">Select your trip dates</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">Start date</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                aria-label="Trip start date"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">End date</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                aria-label="Trip end date"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {getTripDuration() && (
            <div className="mt-4 p-3 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-700 font-medium">
                🎉 {getTripDuration()} day{getTripDuration()! > 1 ? 's' : ''} trip to {destination || 'your destination'}
              </p>
            </div>
          )}
        </section>

        {/* Advanced Options */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-900">Customize your trip</h2>
                <p className="text-sm text-gray-500">Travelers, trip type, vibes (optional)</p>
              </div>
            </div>
            {showAdvanced ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 pt-2 border-t border-gray-100">
              {/* Travelers count */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Number of travelers</label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-700 font-medium">Travelers</span>
                  <div className="flex items-center gap-4">
                    <button
                      aria-label="Decrease travelers"
                      onClick={() => setTravelers(Math.max(1, travelers - 1))}
                      disabled={travelers <= 1}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-semibold text-gray-900 w-8 text-center" aria-live="polite">{travelers}</span>
                    <button
                      aria-label="Increase travelers"
                      onClick={() => setTravelers(Math.min(10, travelers + 1))}
                      disabled={travelers >= 10}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Traveler type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Who's traveling?</label>
                <div className="flex flex-wrap gap-2">
                  {travelerTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setTravelerType(type.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                        travelerType === type.id
                          ? 'border-primary bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span>{type.icon}</span>
                      <span className="font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vibes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What's your vibe?</label>
                <p className="text-sm text-gray-500 mb-3">Select up to 5 that match your travel style</p>
                <div className="flex flex-wrap gap-2">
                  {vibes.map((vibe) => (
                    <button
                      key={vibe.id}
                      onClick={() => toggleVibe(vibe.id)}
                      disabled={!selectedVibes.includes(vibe.id) && selectedVibes.length >= 5}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                        selectedVibes.includes(vibe.id)
                          ? 'border-primary bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      <span>{vibe.emoji}</span>
                      <span className="font-medium">{vibe.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Generate Button */}
        <div className="sticky bottom-0 bg-gray-50 pt-4 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              canGenerate && !isGenerating
                ? 'bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {progressMessage || 'Creating your itinerary...'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Itinerary
              </>
            )}
          </button>
          {generateError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center" role="alert">
              {generateError}
            </div>
          )}
          <p className="text-center text-sm text-gray-500 mt-3">
            {canGenerate ? 'AI will create a personalized day-by-day plan' : 'Select a destination and dates to continue'}
          </p>
        </div>
      </main>
    </div>
  );
}
