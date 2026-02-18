'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, addDays, differenceInDays } from 'date-fns';
import debounce from 'lodash/debounce';
import { Search, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Shield, Clock, Globe, Sparkles, Check, ArrowRight, Minus, Plus, X, Loader2, MapPin } from 'lucide-react';
import 'react-day-picker/dist/style.css';

// Extended destinations for autocomplete
const allDestinations = [
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80', vibe: 'Culture & Tech', avgBudget: 150 },
  { id: 'paris', name: 'Paris', country: 'France', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80', vibe: 'Romance & Art', avgBudget: 180 },
  { id: 'bali', name: 'Bali', country: 'Indonesia', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80', vibe: 'Beach & Wellness', avgBudget: 80 },
  { id: 'santorini', name: 'Santorini', country: 'Greece', image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80', vibe: 'Scenic & Romantic', avgBudget: 200 },
  { id: 'new-york', name: 'New York', country: 'USA', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80', vibe: 'Urban & Nightlife', avgBudget: 220 },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80', vibe: 'Beach & Culture', avgBudget: 140 },
  { id: 'london', name: 'London', country: 'United Kingdom', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80', vibe: 'History & Culture', avgBudget: 190 },
  { id: 'rome', name: 'Rome', country: 'Italy', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80', vibe: 'History & Food', avgBudget: 160 },
  { id: 'dubai', name: 'Dubai', country: 'UAE', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80', vibe: 'Luxury & Modern', avgBudget: 250 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80', vibe: 'Beach & Adventure', avgBudget: 170 },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', image: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80', vibe: 'Culture & Canals', avgBudget: 160 },
  { id: 'kyoto', name: 'Kyoto', country: 'Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80', vibe: 'Traditional & Zen', avgBudget: 140 },
  { id: 'maldives', name: 'Maldives', country: 'Maldives', image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80', vibe: 'Luxury & Beach', avgBudget: 400 },
  { id: 'iceland', name: 'Reykjavik', country: 'Iceland', image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80', vibe: 'Nature & Adventure', avgBudget: 200 },
  { id: 'marrakech', name: 'Marrakech', country: 'Morocco', image: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&q=80', vibe: 'Exotic & Culture', avgBudget: 90 },
];

const trendingDestinations = allDestinations.slice(0, 4);

const travelerTypes = [
  { id: 'solo', label: 'Solo', icon: '🧑' },
  { id: 'couple', label: 'Couple', icon: '💑' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { id: 'friends', label: 'Friends', icon: '👯' },
];

const vibeOptions = [
  { id: 'adventure', label: 'Adventure', emoji: '🏔️' },
  { id: 'relaxation', label: 'Relaxation', emoji: '🏖️' },
  { id: 'cultural', label: 'Cultural', emoji: '🏛️' },
  { id: 'foodie', label: 'Foodie', emoji: '🍜' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { id: 'romantic', label: 'Romantic', emoji: '💕' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
];

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const increment = end / 125;
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{count.toLocaleString()}{suffix}</>;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const INSPIRATIONS = [
  { emoji: '🏖️', label: 'Beach getaway' },
  { emoji: '🏔️', label: 'Mountain escape' },
  { emoji: '🏙️', label: 'City adventure' },
  { emoji: '🍝', label: 'Food & wine tour' },
  { emoji: '🏛️', label: 'History & culture' },
  { emoji: '🌴', label: 'Tropical paradise' },
  { emoji: '❄️', label: 'Winter wonderland' },
  { emoji: '🎭', label: 'Arts & nightlife' },
];

function LiveActivity() {
  const [count, setCount] = useState(127);
  useEffect(() => {
    const interval = setInterval(() => setCount(prev => prev + Math.floor(Math.random() * 3) - 1), 3000);
    return () => clearInterval(interval);
  }, []);
  return count;
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Trip creation state
  const [destination, setDestination] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<typeof allDestinations>([]);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Date picker state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [travelerType, setTravelerType] = useState('couple');
  const [selectedVibes, setSelectedVibes] = useState<string[]>(['cultural', 'foodie']);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedItinerary, setGeneratedItinerary] = useState<any>(null);
  const [error, setError] = useState('');

  const searchRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDestDropdown(false);
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setIsSearching(true);
      // Simulate API delay for realistic feel
      setTimeout(() => {
        const results = allDestinations.filter(d => 
          d.name.toLowerCase().includes(query.toLowerCase()) || 
          d.country.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(results);
        setIsSearching(false);
      }, 150);
    }, 300),
    []
  );

  useEffect(() => {
    if (searchQuery.length > 0) {
      debouncedSearch(searchQuery);
      setShowDestDropdown(true);
    } else {
      setSearchResults(allDestinations.slice(0, 6));
    }
  }, [searchQuery, debouncedSearch]);

  const selectDestination = (dest: typeof allDestinations[0]) => {
    setDestination(dest.name);
    setDestinationCountry(dest.country);
    setSearchQuery('');
    setShowDestDropdown(false);
  };

  const toggleVibe = (vibeId: string) => {
    setSelectedVibes(prev => 
      prev.includes(vibeId) ? prev.filter(v => v !== vibeId) : prev.length < 5 ? [...prev, vibeId] : prev
    );
  };

  const canGenerate = destination && dateRange?.from && dateRange?.to;
  const tripDays = dateRange?.from && dateRange?.to ? differenceInDays(dateRange.to, dateRange.from) + 1 : null;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    
    setIsGenerating(true);
    setError('');
    setGeneratedItinerary(null);
    setGenerationProgress('Analyzing your preferences...');

    try {
      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate: format(dateRange!.from!, 'yyyy-MM-dd'),
          endDate: format(dateRange!.to!, 'yyyy-MM-dd'),
          travelers: { adults: travelers, children: 0 },
          vibes: selectedVibes,
          budget: 'moderate',
          save: false,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to generate');
      }

      setGenerationProgress('Creating your personalized itinerary...');
      const itinerary = await response.json();
      setGeneratedItinerary(itinerary);
    } catch (err) {
      // Show demo data for now
      setGeneratedItinerary({
        destination,
        startDate: format(dateRange!.from!, 'yyyy-MM-dd'),
        endDate: format(dateRange!.to!, 'yyyy-MM-dd'),
        overview: `Your ${tripDays}-day adventure in ${destination} awaits! This itinerary is crafted for your ${selectedVibes.join(', ')} travel style.`,
        days: Array.from({ length: tripDays || 3 }, (_, i) => ({
          dayNumber: i + 1,
          title: `Day ${i + 1}: ${['Arrival & First Impressions', 'Deep Exploration', 'Hidden Gems', 'Cultural Immersion', 'Adventure Day', 'Local Favorites', 'Final Adventures'][i % 7]}`,
          summary: `Discover the best of ${destination} with carefully curated activities, local restaurants, and authentic experiences.`,
        })),
        _demo: true,
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Add dates';
    if (!dateRange.to) return format(dateRange.from, 'MMM d');
    return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`;
  };

  return (
    <div className="min-h-screen bg-white antialiased">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary to-primary-600 flex items-center justify-center shadow-lg shadow-primary/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className={`text-lg font-bold ${isScrolled ? 'text-gray-900' : 'text-white'}`}>TripGenie</span>
            </Link>
            
            <div className="hidden lg:flex items-center gap-1">
              {['Destinations', 'How It Works'].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isScrolled ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                  {item}
                </a>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <button className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isScrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/90 hover:text-white'}`}>Log in</button>
              <button className="bg-primary hover:bg-primary-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary/25 transition-all">Sign up free</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80" alt="Dream destination" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-gray-900/60 to-gray-900/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 via-transparent to-gray-900/30" />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-white/90 text-sm font-medium"><LiveActivity /> travelers planning now</span>
              </div>

              <p className="text-primary-300 font-medium mb-2 text-lg">{getGreeting()} ✨</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
                Plan your perfect trip
                <span className="block mt-2 bg-gradient-to-r from-primary-300 via-primary-200 to-amber-200 bg-clip-text text-transparent">in 60 seconds</span>
              </h1>
              
              <p className="text-lg text-white/80 mb-8 max-w-lg leading-relaxed">
                AI creates personalized day-by-day itineraries. Just tell us where and when — we handle the rest.
              </p>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-white" />
                    ))}
                  </div>
                  <span className="text-white/80 text-sm font-medium">50K+ travelers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold">4.9</span>
                  <span className="text-white/60 text-sm">(12K reviews)</span>
                </div>
              </div>
            </div>

            {/* Right: Trip Creation Card */}
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Plan your trip</h2>
                  <p className="text-sm text-gray-500">AI-powered • Free to use</p>
                </div>
              </div>

              {/* Destination Input with Autocomplete */}
              <div className="mb-4" ref={searchRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Where to?</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    value={destination || searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setDestination(''); }}
                    onFocus={() => setShowDestDropdown(true)}
                    placeholder="Search any city or country..."
                    className="w-full pl-12 pr-10 py-3.5 min-h-[52px] bg-gray-50 border border-gray-200 rounded-xl text-base text-gray-900 placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
                  {(destination || searchQuery) && !isSearching && (
                    <button onClick={() => { setDestination(''); setSearchQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  
                  {showDestDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 max-h-72 overflow-y-auto">
                      {searchQuery.length === 0 && <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">POPULAR DESTINATIONS</div>}
                      {(searchResults.length > 0 ? searchResults : allDestinations.slice(0, 6)).map((dest) => (
                        <button
                          key={dest.id}
                          onClick={() => selectDestination(dest)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                            <Image src={dest.image} alt={dest.name} fill className="object-cover" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-medium text-gray-900">{dest.name}</p>
                            <p className="text-sm text-gray-500">{dest.country}</p>
                          </div>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{dest.vibe}</span>
                        </button>
                      ))}
                      {searchQuery.length > 0 && searchResults.length === 0 && !isSearching && (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <Globe className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>No destinations found</p>
                          <p className="text-sm">Try a different search term</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {destination && destinationCountry && (
                  <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {destination}, {destinationCountry}
                  </p>
                )}
              </div>

              {/* Date Picker */}
              <div className="mb-4" ref={dateRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">When?</label>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`w-full px-4 py-3.5 bg-gray-50 border rounded-xl text-left flex items-center justify-between transition-all ${showDatePicker ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-medium ${dateRange?.from ? 'text-gray-900' : 'text-gray-400'}`}>{formatDateRange()}</p>
                      {tripDays && <p className="text-xs text-primary font-medium">{tripDays} day{tripDays > 1 ? 's' : ''}</p>}
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                </button>
                
                {showDatePicker && (
                  <div className="absolute z-30 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 left-0 right-0 sm:left-auto sm:right-auto max-h-[80vh] overflow-auto">
                    <DayPicker
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      disabled={{ before: new Date() }}
                      showOutsideDays={false}
                      classNames={{
                        months: 'flex flex-col gap-4',
                        month: 'space-y-4',
                        caption: 'flex justify-center pt-1 relative items-center',
                        caption_label: 'text-sm font-semibold text-gray-900',
                        nav: 'flex items-center gap-1',
                        nav_button: 'h-7 w-7 bg-transparent p-0 hover:bg-gray-100 rounded-full flex items-center justify-center',
                        nav_button_previous: 'absolute left-1',
                        nav_button_next: 'absolute right-1',
                        table: 'w-full border-collapse space-y-1',
                        head_row: 'flex',
                        head_cell: 'text-gray-400 rounded-md w-9 font-medium text-xs',
                        row: 'flex w-full mt-1',
                        cell: 'h-9 w-9 text-center text-sm relative',
                        day: 'h-9 w-9 p-0 font-medium rounded-full hover:bg-gray-100 transition-colors',
                        day_range_start: 'bg-primary text-white hover:bg-primary',
                        day_range_end: 'bg-primary text-white hover:bg-primary',
                        day_selected: 'bg-primary text-white hover:bg-primary',
                        day_range_middle: 'bg-primary-50 text-primary-700 rounded-none',
                        day_today: 'border-2 border-primary',
                        day_outside: 'text-gray-300',
                        day_disabled: 'text-gray-300 cursor-not-allowed',
                      }}
                      components={{
                        Chevron: ({ orientation }) => orientation === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />,
                      }}
                    />
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                      <button onClick={() => setDateRange(undefined)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Clear</button>
                      <button onClick={() => setShowDatePicker(false)} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-600">Done</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Trip Preview */}
              {destination && tripDays && (
                <div className="mb-4 p-4 bg-gradient-to-r from-primary-50 to-amber-50 rounded-xl border border-primary-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-xl">✨</div>
                    <div>
                      <p className="font-semibold text-gray-900">{tripDays}-day {destination} trip</p>
                      <p className="text-sm text-gray-600">{format(dateRange!.from!, 'MMM d')} - {format(dateRange!.to!, 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Options Toggle */}
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between py-3 text-gray-600 hover:text-gray-900 transition-colors mb-4 border-t border-gray-100 pt-4">
                <span className="text-sm font-medium flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">⚙️</span>
                  Customize trip preferences
                </span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="space-y-5 mb-6 pb-4">
                  {/* Travelers */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">Travelers</span>
                      <p className="text-xs text-gray-500">How many people?</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setTravelers(Math.max(1, travelers - 1))} disabled={travelers <= 1} className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-semibold text-gray-900">{travelers}</span>
                      <button onClick={() => setTravelers(Math.min(10, travelers + 1))} disabled={travelers >= 10} className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Traveler Type */}
                  <div>
                    <span className="text-sm font-medium text-gray-900 block mb-2">Trip type</span>
                    <div className="grid grid-cols-4 gap-2">
                      {travelerTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setTravelerType(type.id)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                            travelerType === type.id ? 'bg-primary-50 border-2 border-primary' : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                          }`}
                        >
                          <span className="text-xl">{type.icon}</span>
                          <span className={`text-xs font-medium ${travelerType === type.id ? 'text-primary-700' : 'text-gray-600'}`}>{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vibes */}
                  <div>
                    <span className="text-sm font-medium text-gray-900 block mb-2">What's your vibe?</span>
                    <div className="flex flex-wrap gap-2">
                      {vibeOptions.map((vibe) => (
                        <button
                          key={vibe.id}
                          onClick={() => toggleVibe(vibe.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-all ${
                            selectedVibes.includes(vibe.id) ? 'bg-primary-50 text-primary-700 border-2 border-primary' : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:border-gray-200'
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

              {/* Error */}
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl"><p className="text-sm text-red-600">{error}</p></div>}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  canGenerate && !isGenerating ? 'bg-gradient-to-r from-primary to-primary-600 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />{generationProgress || 'Creating magic...'}</>
                ) : (
                  <><Sparkles className="w-5 h-5" />Generate My Itinerary</>
                )}
              </button>
              <p className="text-center text-xs text-gray-500 mt-3 flex items-center justify-center gap-3">
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Free</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> No signup</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Instant</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Generated Itinerary Preview */}
      {generatedItinerary && (
        <section className="py-16 bg-gradient-to-b from-primary-50 to-white" id="itinerary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <Check className="w-4 h-4" /> Itinerary Ready!
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Your {tripDays}-Day {destination} Adventure</h2>
              <p className="text-gray-500">{generatedItinerary.overview}</p>
              {generatedItinerary._demo && <p className="text-amber-600 text-sm mt-2">⚠️ Demo preview — add API key for real AI itineraries</p>}
            </div>

            <div className="space-y-4">
              {generatedItinerary.days?.map((day: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 font-bold">{day.dayNumber}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{day.title}</h3>
                      <p className="text-gray-500 text-sm">{day.summary}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <button className="bg-primary hover:bg-primary-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2">
                View Full Itinerary <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Social Proof */}
      <section className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-8 text-sm">
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Always free to plan</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> No hidden fees</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Book when you're ready</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> 24/7 support</span>
        </div>
      </section>

      {/* Inspiration Chips */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Need inspiration?</h2>
            <p className="text-gray-500">Tap a vibe to get started</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {INSPIRATIONS.map((item) => (
              <button
                key={item.label}
                onClick={() => { setSearchQuery(item.label.split(' ')[0]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-full text-gray-700 font-medium hover:border-primary hover:text-primary hover:bg-primary-50 shadow-sm hover:shadow-md transition-all"
              >
                <span className="text-xl">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Destinations */}
      <section id="destinations" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Trending destinations</h2>
            <p className="text-gray-500 text-lg">Get inspired by where others are traveling</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingDestinations.map((dest, i) => (
              <div key={i} className="group cursor-pointer" onClick={() => { selectDestination(dest); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden mb-4">
                  <Image src={dest.image} alt={dest.name} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-xs font-medium">{dest.vibe}</span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white mb-1">{dest.name}</h3>
                    <p className="text-white/80 text-sm">{dest.country}</p>
                  </div>
                </div>
                <button className="w-full py-3 bg-gray-100 hover:bg-primary hover:text-white rounded-xl font-medium text-gray-700 transition-all flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> Plan this trip
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">How TripGenie works</h2>
            <p className="text-xl text-gray-500">Plan smarter, travel better</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Tell us your trip', desc: 'Enter where you want to go and when. Add preferences for a personalized experience.', icon: '📝' },
              { step: '02', title: 'AI creates your plan', desc: 'Our AI builds a day-by-day itinerary with activities, restaurants, and local tips.', icon: '✨' },
              { step: '03', title: 'Book when ready', desc: 'Review your plan, make changes, and book flights, hotels, or experiences whenever you want.', icon: '🚀' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl mb-6">{item.icon}</div>
                <div className="text-sm font-bold text-primary mb-2">STEP {item.step}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Everything you need in one place</h2>
            <p className="text-xl text-gray-500">AI-powered planning with real bookings</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-50 to-amber-50 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Planning</h3>
              <p className="text-gray-600">Smart algorithms create personalized itineraries based on your preferences and travel style.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Viator Activities</h3>
              <p className="text-gray-600">Access thousands of tours and experiences from Viator, bookable directly from your itinerary.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hotel Booking</h3>
              <p className="text-gray-600">Find and book the perfect accommodation with competitive prices and verified reviews.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Restaurant Reservations</h3>
              <p className="text-gray-600">Discover local gems and make reservations at the best restaurants in your destination.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials / Social Proof */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Loved by travelers worldwide</h2>
            <p className="text-xl text-gray-500">Join thousands planning smarter trips</p>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">
                <AnimatedCounter value={50} suffix="K+" />
              </div>
              <p className="text-gray-600 font-medium">Happy Travelers</p>
            </div>
            <div className="text-center">
              <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">
                <AnimatedCounter value={120} suffix="K+" />
              </div>
              <p className="text-gray-600 font-medium">Trips Planned</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-4xl lg:text-5xl font-bold text-primary">4.9</span>
                <div className="flex text-amber-400">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 fill-current" />)}
                </div>
              </div>
              <p className="text-gray-600 font-medium">Average Rating</p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Sarah Johnson',
                location: 'New York, USA',
                trip: 'Paris & Barcelona',
                quote: 'TripGenie saved me hours of planning! The AI knew exactly what I wanted and created the perfect itinerary. Every restaurant was amazing.',
                avatar: '👩🏼‍💼'
              },
              {
                name: 'Marcus Chen',
                location: 'Singapore',
                trip: 'Tokyo Adventure',
                quote: 'I was skeptical about AI planning, but this blew me away. The day-by-day breakdown with bookable activities made everything so easy.',
                avatar: '👨🏻‍💻'
              },
              {
                name: 'Emma Rodriguez',
                location: 'Madrid, Spain',
                trip: 'Bali Getaway',
                quote: 'Best travel planning tool ever! Found hidden gems I would never have discovered on my own. Highly recommend for solo travelers.',
                avatar: '👩🏽‍🎨'
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map(j => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-gray-700 mb-6 italic">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-amber-100 flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.location}</p>
                    <p className="text-xs text-primary mt-0.5">Trip: {testimonial.trip}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App CTA */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-primary-500 via-primary to-primary-600 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-5xl font-bold mb-6">Take your trips on the go</h2>
              <p className="text-xl text-white/90 mb-8 leading-relaxed">
                Download the TripGenie mobile app to access your itineraries offline, get real-time updates, and discover new places while you travel.
              </p>
              
              <div className="flex flex-wrap gap-4 mb-8">
                <a href="https://apps.apple.com/app/tripgenie" className="inline-flex items-center gap-3 bg-black hover:bg-gray-900 px-6 py-4 rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs opacity-80">Download on the</div>
                    <div className="text-lg">App Store</div>
                  </div>
                </a>
                
                <a href="https://play.google.com/store/apps/details?id=com.tripgenie" className="inline-flex items-center gap-3 bg-black hover:bg-gray-900 px-6 py-4 rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs opacity-80">GET IT ON</div>
                    <div className="text-lg">Google Play</div>
                  </div>
                </a>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-300" />
                  <span>Offline access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-300" />
                  <span>Real-time updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-300" />
                  <span>GPS navigation</span>
                </div>
              </div>
            </div>
            
            <div className="relative lg:block hidden">
              <div className="relative w-full max-w-sm mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl blur-2xl"></div>
                <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
                  <div className="bg-white rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                      <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Tokyo</h4>
                        <p className="text-sm text-gray-500">7-day adventure</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {['Day 1: Arrival & Shibuya', 'Day 2: Traditional Tokyo', 'Day 3: Mount Fuji Day Trip'].map((day, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold">{i+1}</div>
                          <span className="text-sm text-gray-700">{day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold">TripGenie</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">How it Works</a>
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Help</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            © 2026 TripGenie. Free to use. We earn when you book.
          </div>
        </div>
      </footer>
    </div>
  );
}
