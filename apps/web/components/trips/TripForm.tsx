'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { 
  ArrowLeft, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Users, 
  Sparkles,
  Minus,
  Plus,
  Loader2,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DestinationInput } from './DestinationInput'
import { DatePicker } from './DatePicker'

// Validation schema
const tripSchema = z.object({
  destination: z.string().min(1, 'Please select a destination'),
  startDate: z.date({ required_error: 'Please select a start date', invalid_type_error: 'Please select a start date' }),
  endDate: z.date({ required_error: 'Please select an end date', invalid_type_error: 'Please select an end date' }),
  adults: z.number().min(1, 'At least 1 adult required').max(20),
  children: z.number().min(0).max(20),
  budget: z.enum(['budget', 'moderate', 'luxury', 'ultra-luxury']),
  vibes: z.array(z.string()).min(1, 'Select at least one vibe').max(5),
  interests: z.array(z.string()),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
})

type TripFormData = z.infer<typeof tripSchema>

const budgetOptions = [
  { id: 'budget', label: 'Budget', emoji: '💰', description: 'Save where possible' },
  { id: 'moderate', label: 'Moderate', emoji: '💵', description: 'Balanced spending' },
  { id: 'luxury', label: 'Luxury', emoji: '💎', description: 'Premium experiences' },
  { id: 'ultra-luxury', label: 'Ultra Luxury', emoji: '👑', description: 'No limits' },
]

const vibeOptions = [
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
]

const interestOptions = [
  { id: 'museums', label: 'Museums', emoji: '🖼️' },
  { id: 'beaches', label: 'Beaches', emoji: '🏖️' },
  { id: 'hiking', label: 'Hiking', emoji: '🥾' },
  { id: 'local-food', label: 'Local Food', emoji: '🥘' },
  { id: 'architecture', label: 'Architecture', emoji: '🏗️' },
  { id: 'markets', label: 'Markets', emoji: '🛒' },
  { id: 'nightclubs', label: 'Nightclubs', emoji: '🪩' },
  { id: 'temples', label: 'Temples', emoji: '⛩️' },
  { id: 'wine', label: 'Wine & Spirits', emoji: '🍷' },
  { id: 'water-sports', label: 'Water Sports', emoji: '🏄' },
  { id: 'art', label: 'Art Galleries', emoji: '🎨' },
  { id: 'history', label: 'Historical Sites', emoji: '🏰' },
]

const STEPS = [
  { id: 1, title: 'Destination', icon: MapPin },
  { id: 2, title: 'Dates', icon: Calendar },
  { id: 3, title: 'Travelers', icon: Users },
  { id: 4, title: 'Preferences', icon: Sparkles },
]

export function TripForm() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      destination: '',
      adults: 2,
      children: 0,
      budget: 'moderate',
      vibes: [],
      interests: [],
    },
    mode: 'onChange',
  })

  const watchedValues = watch()

  // Validate current step before proceeding
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        return await trigger('destination')
      case 2:
        const startValid = await trigger('startDate')
        const endValid = await trigger('endDate')
        return startValid && endValid
      case 3:
        return await trigger(['adults', 'children'])
      case 4:
        return await trigger(['budget', 'vibes'])
      default:
        return true
    }
  }

  const handleNext = async () => {
    const isValid = await validateStep(currentStep)
    if (isValid && currentStep < 4) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const onSubmit = async (data: TripFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: data.destination,
          start_date: data.startDate.toISOString().split('T')[0],
          end_date: data.endDate.toISOString().split('T')[0],
          travelers: data.adults + data.children,
          preferences: {
            adults: data.adults,
            children: data.children,
            budget: data.budget,
            vibes: data.vibes,
            interests: data.interests,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create trip')
      }

      const { trip } = await response.json()
      router.push(`/trips/${trip.id}`)
    } catch (error) {
      console.error('Error creating trip:', error)
      // TODO: Show error toast
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => step.id < currentStep && setCurrentStep(step.id)}
              disabled={step.id > currentStep}
              className={cn(
                'flex items-center gap-2 transition-all',
                step.id === currentStep && 'text-primary',
                step.id < currentStep && 'text-green-600 cursor-pointer',
                step.id > currentStep && 'text-gray-300 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  step.id === currentStep && 'border-primary bg-primary-50',
                  step.id < currentStep && 'border-green-600 bg-green-50',
                  step.id > currentStep && 'border-gray-200'
                )}
              >
                {step.id < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <span className="hidden sm:block text-sm font-medium">{step.title}</span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        {/* Step 1: Destination */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Where do you want to go? 🌍
              </h2>
              <p className="text-gray-500">
                Search for a city, country, or region
              </p>
            </div>

            <Controller
              name="destination"
              control={control}
              render={({ field }) => (
                <DestinationInput
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.destination?.message}
                />
              )}
            />
          </div>
        )}

        {/* Step 2: Dates */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                When are you traveling? 📅
              </h2>
              <p className="text-gray-500">
                Select your trip dates
              </p>
            </div>

            <Controller
              name="startDate"
              control={control}
              render={({ field: startField }) => (
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field: endField }) => (
                    <DatePicker
                      startDate={startField.value}
                      endDate={endField.value}
                      onStartDateChange={startField.onChange}
                      onEndDateChange={endField.onChange}
                      startError={errors.startDate?.message}
                      endError={errors.endDate?.message}
                    />
                  )}
                />
              )}
            />
          </div>
        )}

        {/* Step 3: Travelers */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Who&apos;s traveling? 👥
              </h2>
              <p className="text-gray-500">
                Tell us about your travel group
              </p>
            </div>

            {/* Adults counter */}
            <Controller
              name="adults"
              control={control}
              render={({ field }) => (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Adults</p>
                    <p className="text-sm text-gray-500">Ages 18+</p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.max(1, field.value - 1))}
                      disabled={field.value <= 1}
                      className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-semibold text-gray-900 w-8 text-center">
                      {field.value}
                    </span>
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.min(20, field.value + 1))}
                      disabled={field.value >= 20}
                      className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            />

            {/* Children counter */}
            <Controller
              name="children"
              control={control}
              render={({ field }) => (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">Children</p>
                    <p className="text-sm text-gray-500">Ages 0-17</p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.max(0, field.value - 1))}
                      disabled={field.value <= 0}
                      className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-semibold text-gray-900 w-8 text-center">
                      {field.value}
                    </span>
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.min(20, field.value + 1))}
                      disabled={field.value >= 20}
                      className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            />

            {errors.adults && (
              <p className="text-sm text-red-500">{errors.adults.message}</p>
            )}
          </div>
        )}

        {/* Step 4: Preferences */}
        {currentStep === 4 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Customize your trip ✨
              </h2>
              <p className="text-gray-500">
                Help us create the perfect itinerary for you
              </p>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Budget level
              </label>
              <Controller
                name="budget"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-3">
                    {budgetOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => field.onChange(option.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          field.value === option.id
                            ? 'border-primary bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span className="text-2xl">{option.emoji}</span>
                        <p className="font-medium text-gray-900 mt-1">{option.label}</p>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Vibes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What&apos;s your vibe?
              </label>
              <p className="text-sm text-gray-500 mb-3">Select 1-5 that match your style</p>
              <Controller
                name="vibes"
                control={control}
                render={({ field }) => (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {vibeOptions.map((vibe) => (
                        <button
                          key={vibe.id}
                          type="button"
                          onClick={() => {
                            const newValue = field.value.includes(vibe.id)
                              ? field.value.filter((v: string) => v !== vibe.id)
                              : field.value.length < 5
                              ? [...field.value, vibe.id]
                              : field.value
                            field.onChange(newValue)
                          }}
                          disabled={!field.value.includes(vibe.id) && field.value.length >= 5}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all',
                            field.value.includes(vibe.id)
                              ? 'border-primary bg-primary-50 text-primary-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <span>{vibe.emoji}</span>
                          <span className="font-medium">{vibe.label}</span>
                        </button>
                      ))}
                    </div>
                    {errors.vibes && (
                      <p className="mt-2 text-sm text-red-500">{errors.vibes.message}</p>
                    )}
                  </>
                )}
              />
            </div>

            {/* Interests (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specific interests
              </label>
              <p className="text-sm text-gray-500 mb-3">Optional - help us fine-tune your itinerary</p>
              <Controller
                name="interests"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => (
                      <button
                        key={interest.id}
                        type="button"
                        onClick={() => {
                          const newValue = field.value.includes(interest.id)
                            ? field.value.filter((i: string) => i !== interest.id)
                            : [...field.value, interest.id]
                          field.onChange(newValue)
                        }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-full border-2 text-sm transition-all',
                          field.value.includes(interest.id)
                            ? 'border-primary bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <span>{interest.emoji}</span>
                        <span className="font-medium">{interest.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 1}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
            currentStep === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-600 transition-all shadow-md shadow-primary/25"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-600 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Create Trip
              </>
            )}
          </button>
        )}
      </div>
    </form>
  )
}
