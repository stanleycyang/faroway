'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, MapPin, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Popular destinations for quick selection
const popularDestinations = [
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', emoji: '🗼' },
  { id: 'paris', name: 'Paris', country: 'France', emoji: '🗼' },
  { id: 'new-york', name: 'New York', country: 'USA', emoji: '🗽' },
  { id: 'bali', name: 'Bali', country: 'Indonesia', emoji: '🏝️' },
  { id: 'london', name: 'London', country: 'UK', emoji: '🇬🇧' },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', emoji: '🇪🇸' },
  { id: 'rome', name: 'Rome', country: 'Italy', emoji: '🏛️' },
  { id: 'dubai', name: 'Dubai', country: 'UAE', emoji: '🏙️' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', emoji: '🦘' },
  { id: 'santorini', name: 'Santorini', country: 'Greece', emoji: '🇬🇷' },
]

interface Destination {
  id: string
  name: string
  country: string
  emoji?: string
}

interface DestinationInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  className?: string
}

export function DestinationInput({ value, onChange, error, className }: DestinationInputProps) {
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Destination[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter destinations based on query
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions(popularDestinations)
      return
    }

    setIsLoading(true)
    // Simulate search delay (replace with Google Places API)
    const timer = setTimeout(() => {
      const filtered = popularDestinations.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.country.toLowerCase().includes(query.toLowerCase())
      )
      
      // If no matches and user typed something, allow custom destination
      if (filtered.length === 0 && query.trim()) {
        setSuggestions([{ id: 'custom', name: query, country: 'Custom destination', emoji: '📍' }])
      } else {
        setSuggestions(filtered)
      }
      setIsLoading(false)
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (destination: Destination) => {
    const fullValue = destination.id === 'custom' 
      ? destination.name 
      : `${destination.name}, ${destination.country}`
    setQuery(fullValue)
    onChange(fullValue)
    setIsOpen(false)
  }

  const handleClear = () => {
    setQuery('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck="false"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search for a destination..."
          className={cn(
            'w-full pl-12 pr-10 py-4 min-h-[52px] bg-gray-50 border rounded-xl text-base text-gray-900 placeholder-gray-400 outline-none transition-all',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
              : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
          )}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {!query.trim() && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Popular Destinations
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="px-4 py-6 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="max-h-64 overflow-auto">
              {suggestions.map((destination) => (
                <li key={destination.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(destination)}
                    className="w-full px-4 py-3 min-h-[52px] flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-xl">{destination.emoji || '📍'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{destination.name}</p>
                      <p className="text-sm text-gray-500 truncate">{destination.country}</p>
                    </div>
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-gray-500">
              No destinations found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
