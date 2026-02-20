import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  normalizeDestination,
  matchDestination,
  getCurrentSeason,
  computePopularScore,
  computeTrendingScore,
  getSeasonBoost,
  type DestinationRow,
} from '@/lib/destinations'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Minimal DestinationRow factory — only the fields used by matchDestination */
function makeDestination(
  overrides: Partial<DestinationRow> & Pick<DestinationRow, 'name_normalized' | 'aliases'>
): DestinationRow {
  return {
    id: 'dest-1',
    slug: 'test',
    name: 'Test',
    country: 'Testland',
    description: '',
    image: '',
    tags: [],
    seasons: {},
    currency: 'USD',
    language: 'en',
    best_time: '',
    base_popularity_score: 0,
    ...overrides,
  }
}

// ── normalizeDestination ───────────────────────────────────────────────────────

describe('normalizeDestination', () => {
  it('lowercases a basic string', () => {
    expect(normalizeDestination('Tokyo')).toBe('tokyo')
  })

  it('takes only the part before the first comma', () => {
    expect(normalizeDestination('Paris, France')).toBe('paris')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeDestination('  Bangkok  ')).toBe('bangkok')
  })

  it('handles uppercase input', () => {
    expect(normalizeDestination('NEW YORK')).toBe('new york')
  })

  it('handles a string with multiple commas', () => {
    expect(normalizeDestination('Rome, Lazio, Italy')).toBe('rome')
  })

  it('returns an empty string for empty input', () => {
    expect(normalizeDestination('')).toBe('')
  })

  it('trims whitespace before the comma', () => {
    expect(normalizeDestination('  Lisbon , Portugal')).toBe('lisbon')
  })
})

// ── matchDestination ───────────────────────────────────────────────────────────

describe('matchDestination', () => {
  const destinations: DestinationRow[] = [
    makeDestination({
      id: 'd-tokyo',
      name: 'Tokyo',
      name_normalized: 'tokyo',
      aliases: ['TYO', 'Tokio'],
    }),
    makeDestination({
      id: 'd-paris',
      name: 'Paris',
      name_normalized: 'paris',
      aliases: ['City of Light', 'Paree'],
    }),
  ]

  it('matches by normalized name', () => {
    const result = matchDestination('Tokyo', destinations)
    expect(result).toBeDefined()
    expect(result!.id).toBe('d-tokyo')
  })

  it('matches by alias (case-insensitive)', () => {
    const result = matchDestination('tyo', destinations)
    expect(result).toBeDefined()
    expect(result!.id).toBe('d-tokyo')
  })

  it('matches alias with different casing', () => {
    const result = matchDestination('CITY OF LIGHT', destinations)
    expect(result).toBeDefined()
    expect(result!.id).toBe('d-paris')
  })

  it('returns undefined when no match is found', () => {
    const result = matchDestination('Berlin', destinations)
    expect(result).toBeUndefined()
  })

  it('matches when raw input contains a comma', () => {
    const result = matchDestination('Paris, France', destinations)
    expect(result).toBeDefined()
    expect(result!.id).toBe('d-paris')
  })

  it('returns undefined for an empty destinations array', () => {
    const result = matchDestination('Tokyo', [])
    expect(result).toBeUndefined()
  })
})

// ── getCurrentSeason ───────────────────────────────────────────────────────────

describe('getCurrentSeason', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns winter for January (month 1)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15)) // Jan 15
    const { season, month } = getCurrentSeason()
    expect(season).toBe('winter')
    expect(month).toBe(1)
  })

  it('returns winter for February (month 2)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 10)) // Feb 10
    const { season, month } = getCurrentSeason()
    expect(season).toBe('winter')
    expect(month).toBe(2)
  })

  it('returns winter for December (month 12)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 11, 25)) // Dec 25
    const { season, month } = getCurrentSeason()
    expect(season).toBe('winter')
    expect(month).toBe(12)
  })

  it('returns spring for March (month 3)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 1)) // Mar 1
    const { season, month } = getCurrentSeason()
    expect(season).toBe('spring')
    expect(month).toBe(3)
  })

  it('returns spring for May (month 5)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31)) // May 31
    const { season, month } = getCurrentSeason()
    expect(season).toBe('spring')
    expect(month).toBe(5)
  })

  it('returns summer for June (month 6)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 21)) // Jun 21
    const { season, month } = getCurrentSeason()
    expect(season).toBe('summer')
    expect(month).toBe(6)
  })

  it('returns summer for August (month 8)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 15)) // Aug 15
    const { season, month } = getCurrentSeason()
    expect(season).toBe('summer')
    expect(month).toBe(8)
  })

  it('returns fall for September (month 9)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1)) // Sep 1
    const { season, month } = getCurrentSeason()
    expect(season).toBe('fall')
    expect(month).toBe(9)
  })

  it('returns fall for November (month 11)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 30)) // Nov 30
    const { season, month } = getCurrentSeason()
    expect(season).toBe('fall')
    expect(month).toBe(11)
  })
})

// ── computePopularScore ────────────────────────────────────────────────────────

describe('computePopularScore', () => {
  it('returns 0 when all inputs are zero', () => {
    expect(computePopularScore(0, 0, 0)).toBe(0)
  })

  it('applies the correct formula: trips*3 + searches*1 + base*0.5', () => {
    // 10*3 + 20*1 + 40*0.5 = 30 + 20 + 20 = 70
    expect(computePopularScore(10, 20, 40)).toBe(70)
  })

  it('weights trip count by 3', () => {
    expect(computePopularScore(1, 0, 0)).toBe(3)
  })

  it('weights search count by 1', () => {
    expect(computePopularScore(0, 1, 0)).toBe(1)
  })

  it('weights base score by 0.5', () => {
    expect(computePopularScore(0, 0, 10)).toBe(5)
  })

  it('handles large values', () => {
    expect(computePopularScore(1000, 5000, 200)).toBe(3000 + 5000 + 100)
  })
})

// ── computeTrendingScore ───────────────────────────────────────────────────────

describe('computeTrendingScore', () => {
  it('returns 0 when all inputs are zero', () => {
    expect(computeTrendingScore(0, 0, 0)).toBe(0)
  })

  it('applies the correct formula: recentTrips*5 + recentSearches*2 + seasonBoost', () => {
    // 4*5 + 10*2 + 20 = 20 + 20 + 20 = 60
    expect(computeTrendingScore(4, 10, 20)).toBe(60)
  })

  it('weights recent trips by 5', () => {
    expect(computeTrendingScore(1, 0, 0)).toBe(5)
  })

  it('weights recent searches by 2', () => {
    expect(computeTrendingScore(0, 1, 0)).toBe(2)
  })

  it('adds season boost directly', () => {
    expect(computeTrendingScore(0, 0, 15)).toBe(15)
  })

  it('handles large values', () => {
    expect(computeTrendingScore(500, 3000, 20)).toBe(2500 + 6000 + 20)
  })
})

// ── getSeasonBoost ─────────────────────────────────────────────────────────────

describe('getSeasonBoost', () => {
  it('returns 20 when the month is in peak', () => {
    const seasons = { peak: [6, 7, 8], good: [5, 9], off: [12, 1, 2] }
    expect(getSeasonBoost(seasons, 7)).toBe(20)
  })

  it('returns 10 when the month is in good', () => {
    const seasons = { peak: [6, 7, 8], good: [5, 9], off: [12, 1, 2] }
    expect(getSeasonBoost(seasons, 5)).toBe(10)
  })

  it('returns 0 when the month is in off', () => {
    const seasons = { peak: [6, 7, 8], good: [5, 9], off: [12, 1, 2] }
    expect(getSeasonBoost(seasons, 1)).toBe(0)
  })

  it('returns 0 when the month is not in any array', () => {
    const seasons = { peak: [6, 7, 8], good: [5, 9] }
    expect(getSeasonBoost(seasons, 3)).toBe(0)
  })

  it('returns 0 for empty seasons object', () => {
    expect(getSeasonBoost({}, 6)).toBe(0)
  })

  it('returns 0 when peak is undefined and month is not in good', () => {
    const seasons = { good: [4, 5] }
    expect(getSeasonBoost(seasons, 8)).toBe(0)
  })

  it('returns 10 when peak is undefined but month is in good', () => {
    const seasons = { good: [4, 5] }
    expect(getSeasonBoost(seasons, 4)).toBe(10)
  })

  it('prefers peak over good when month is in both', () => {
    const seasons = { peak: [6, 7], good: [6, 7, 8] }
    expect(getSeasonBoost(seasons, 6)).toBe(20)
  })
})
