# Wanderlust - AI Travel Itinerary App

## Vision

An award-winning mobile app that uses AI agents to craft personalized travel itineraries, removing the friction of trip planning while generating revenue through affiliate partnerships.

## Core Value Proposition

- **For travelers**: Input your destination and dates, get a complete, bookable itinerary in seconds
- **For us**: Earn affiliate commissions on every booking made through the app

---

## Product Requirements

### Core Inputs (Required)

- **Destination**: City, region, or country
- **Dates**: Start and end date (or duration)

### Enhanced Inputs (Optional, for personalization)

- **Travelers**: Solo, couple, family, group (with ages if relevant)
- **Interests & Vibes**: Adventure, relaxation, culture, foodie, nightlife, nature, romantic, budget-friendly, luxury
- **Budget**: Daily budget range or total trip budget
- **Pace**: Packed schedule vs. relaxed with free time
- **Accommodation preferences**: Hotel, Airbnb, hostel, boutique
- **Dietary restrictions**: For restaurant recommendations
- **Mobility considerations**: Accessibility needs

---

## Features (MVP)

### 1. Onboarding Flow

- Beautiful, Airbnb-style welcome screens
- Quick account creation (email, Google, Apple)
- Preference quiz for baseline personalization

### 2. Trip Creation

- Elegant destination search with stunning imagery
- Smart date picker
- Progressive disclosure of optional inputs
- "Surprise me" mode for spontaneous travelers

### 3. AI Itinerary Generation

- Real-time itinerary building with visual feedback
- Day-by-day breakdown with:
  - Morning/afternoon/evening activities
  - Restaurant recommendations
  - Transportation suggestions
  - Time estimates and optimal routing
- Alternative suggestions for each slot

### 4. Itinerary View

- Beautiful timeline/card-based design
- Interactive map integration
- Weather forecasts for each day
- One-tap booking for:
  - Hotels (the former hotel supplier affiliate)
  - Experiences (Viator, GetYourGuide affiliate)
  - Flights (Skyscanner, Kayak affiliate)
  - Restaurants (OpenTable, Resy affiliate)

### 5. Trip Management

- Save and edit itineraries
- Share with travel companions
- Offline access
- Real-time adjustments during travel

---

## Design Principles

### Visual Design

- **Clean, minimal UI** with focus on imagery
- **Large, stunning photography** for destinations
- **Smooth animations** and micro-interactions
- **Consistent spacing** and typography (Inter/SF Pro)
- **Color palette**: Warm neutrals with accent colors

### UX Principles

- **Progressive disclosure**: Don't overwhelm, reveal complexity gradually
- **Sensible defaults**: Smart suggestions reduce cognitive load
- **Delight moments**: Celebrate trip creation, booking milestones
- **Trust signals**: Reviews, ratings, partner logos

---

## Technical Architecture

### Frontend

- **Framework**: React Native with Expo
- **Styling**: NativeWind (Tailwind for RN)
- **Navigation**: Expo Router (file-based routing)
- **State**: Zustand for simplicity
- **Animations**: React Native Reanimated

### Backend (Future)

- API routes for AI itinerary generation
- User authentication and data storage
- Affiliate link tracking and attribution

### AI Integration

- AI Gateway for itinerary generation
- Structured output for consistent formatting
- Context-aware suggestions based on real-time data

---

## Revenue Model

### Affiliate Partnerships

| Partner                   | Category          | Commission |
| ------------------------- | ----------------- | ---------- |
| the former hotel supplier | Hotels            | 4-6%       |
| Expedia                   | Hotels/Packages   | 4-8%       |
| Viator                    | Experiences       | 8%         |
| GetYourGuide              | Tours             | 8%         |
| Skyscanner                | Flights           | CPC model  |
| Klook                     | Activities (Asia) | 5-8%       |

### Future Revenue Streams

- Premium subscription for advanced features
- Sponsored placements (ethically disclosed)
- White-label B2B offering

---

## Development Phases

### Phase 1: MVP (Current Sprint)

- [x] Project setup with Expo
- [ ] Core UI components and design system
- [ ] Onboarding flow
- [ ] Trip input form
- [ ] Static itinerary display
- [ ] Beautiful, responsive layouts

### Phase 2: AI Integration

- [ ] AI itinerary generation API
- [ ] Real-time generation UI
- [ ] Alternative suggestions

### Phase 3: Booking Integration

- [ ] Affiliate link infrastructure
- [ ] Hotel search and booking flow
- [ ] Experience booking
- [ ] Deep linking to partners

### Phase 4: Polish & Launch

- [ ] Animations and micro-interactions
- [ ] Offline support
- [ ] Push notifications
- [ ] App Store optimization

---

## File Structure

```
wanderlust/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home/Explore
│   │   ├── trips.tsx      # My Trips
│   │   └── profile.tsx    # Profile
│   ├── onboarding/        # Onboarding flow
│   ├── create/            # Trip creation flow
│   └── trip/[id].tsx      # Trip detail view
├── components/            # Reusable components
│   ├── ui/               # Design system primitives
│   └── features/         # Feature-specific components
├── lib/                  # Utilities and helpers
├── hooks/                # Custom React hooks
├── stores/               # Zustand stores
├── constants/            # Theme, colors, etc.
└── assets/               # Images, fonts
```

---

## Success Metrics

- **User acquisition**: App downloads, sign-ups
- **Engagement**: Trips created, itinerary completion rate
- **Conversion**: Booking click-through rate, affiliate revenue
- **Retention**: Return users, trips per user
- **NPS**: User satisfaction score

---

## Competitive Advantages

1. **AI-first approach**: Not just aggregation, true intelligent planning
2. **Beautiful design**: Emotional connection through aesthetics
3. **Seamless booking**: One-tap from plan to booked
4. **Personalization**: Learns preferences over time
5. **Social sharing**: Built for the Instagram generation

---

Let's build something people love to use. ✈️
