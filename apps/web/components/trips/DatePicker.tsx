'use client'

import React, { useState } from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import { format, addDays } from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'react-day-picker/style.css'

interface DatePickerProps {
  startDate: Date | undefined
  endDate: Date | undefined
  onStartDateChange: (date: Date | undefined) => void
  onEndDateChange: (date: Date | undefined) => void
  startError?: string
  endError?: string
  className?: string
}

export function DatePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startError,
  endError,
  className,
}: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMode, setCalendarMode] = useState<'start' | 'end'>('start')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range) {
      onStartDateChange(range.from)
      onEndDateChange(range.to)
      if (range.from && range.to) {
        setShowCalendar(false)
      }
    }
  }

  const getDuration = () => {
    if (!startDate || !endDate) return null
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return days
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Date inputs */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Start date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start date
          </label>
          <button
            type="button"
            onClick={() => {
              setCalendarMode('start')
              setShowCalendar(true)
            }}
            className={cn(
              'w-full px-4 py-3 bg-gray-50 border rounded-xl text-left flex items-center gap-3 transition-all',
              startError
                ? 'border-red-300 focus:border-red-500'
                : showCalendar && calendarMode === 'start'
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className={startDate ? 'text-gray-900' : 'text-gray-400'}>
              {startDate ? format(startDate, 'MMM d, yyyy') : 'Select start date'}
            </span>
          </button>
          {startError && <p className="mt-1.5 text-sm text-red-500">{startError}</p>}
        </div>

        {/* End date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End date
          </label>
          <button
            type="button"
            onClick={() => {
              setCalendarMode('end')
              setShowCalendar(true)
            }}
            className={cn(
              'w-full px-4 py-3 bg-gray-50 border rounded-xl text-left flex items-center gap-3 transition-all',
              endError
                ? 'border-red-300 focus:border-red-500'
                : showCalendar && calendarMode === 'end'
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className={endDate ? 'text-gray-900' : 'text-gray-400'}>
              {endDate ? format(endDate, 'MMM d, yyyy') : 'Select end date'}
            </span>
          </button>
          {endError && <p className="mt-1.5 text-sm text-red-500">{endError}</p>}
        </div>
      </div>

      {/* Duration pill */}
      {getDuration() && (
        <div className="p-3 bg-primary-50 rounded-xl">
          <p className="text-sm text-primary-700 font-medium flex items-center gap-2">
            <span>🎉</span>
            {getDuration()} day{getDuration()! > 1 ? 's' : ''} trip
          </p>
        </div>
      )}

      {/* Calendar popup */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-4 max-w-fit">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Select dates</h3>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <DayPicker
              mode="range"
              selected={{ from: startDate, to: endDate }}
              onSelect={handleRangeSelect}
              disabled={{ before: today }}
              numberOfMonths={typeof window !== 'undefined' && window.innerWidth >= 640 ? 2 : 1}
              showOutsideDays
              classNames={{
                root: 'rdp-custom',
                months: 'flex flex-col sm:flex-row gap-4',
                month: 'space-y-4',
                caption: 'flex justify-center pt-1 relative items-center',
                caption_label: 'text-sm font-medium text-gray-900',
                nav: 'space-x-1 flex items-center',
                button_previous: 'absolute left-1 h-7 w-7 bg-transparent p-0 hover:bg-gray-100 rounded-lg flex items-center justify-center',
                button_next: 'absolute right-1 h-7 w-7 bg-transparent p-0 hover:bg-gray-100 rounded-lg flex items-center justify-center',
                table: 'w-full border-collapse space-y-1',
                head_row: 'flex',
                head_cell: 'text-gray-500 rounded-md w-9 font-normal text-[0.8rem]',
                row: 'flex w-full mt-2',
                cell: 'text-center text-sm p-0 relative',
                day: 'h-9 w-9 p-0 font-normal rounded-lg hover:bg-gray-100',
                day_selected: 'bg-primary text-white hover:bg-primary-600',
                day_today: 'bg-gray-100 font-semibold',
                day_outside: 'text-gray-400 opacity-50',
                day_disabled: 'text-gray-300 cursor-not-allowed',
                day_range_start: 'bg-primary text-white rounded-l-lg',
                day_range_end: 'bg-primary text-white rounded-r-lg',
                day_range_middle: 'bg-primary-50 text-primary-700 rounded-none',
              }}
            />
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  onStartDateChange(undefined)
                  onEndDateChange(undefined)
                }}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
