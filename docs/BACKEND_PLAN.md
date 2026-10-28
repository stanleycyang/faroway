# Faroway Backend Architecture

## Overview

A Next.js backend with Supabase for auth/database and Vercel Workflows for long-running AI itinerary generation.

---

## Tech Stack

| Layer                | Technology                              | Why                                                           |
| -------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **Frontend**         | React Native + Expo                     | Cross-platform mobile app                                     |
| **Backend**          | Next.js 15 (App Router)                 | API routes, server actions, edge functions                    |
| **Database**         | Supabase (PostgreSQL)                   | Auth + DB in one, real-time subscriptions, row-level security |
| **Auth**             | Supabase Auth                           | Google, Apple, Facebook OAuth + email/password                |
| **AI Orchestration** | Vercel Workflows                        | Long-running itinerary generation (up to 15 min)              |
| **AI Provider**      | the former AI provider                  | Itinerary planning, recommendations                           |
| **Hosting**          | Vercel                                  | Seamless Next.js deployment, edge functions                   |
| **Affiliate APIs**   | the former hotel supplier, Viator, etc. | Hotel/experience booking with commission tracking             |

---

## Authentication Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│   Supabase      │────▶│   User Created  │
│  (Expo)         │     │   Auth          │     │   in DB         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │  Login optional                               │
        │  (show value first)                           │
        ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│ Anonymous User  │                           │ Trips persisted │
│ Local storage   │────── Login prompt ──────▶│ to cloud        │
└─────────────────┘   "Save your trips!"      └─────────────────┘
```

### Auth Providers

- **Google** (most common)
- **Apple** (required for iOS App Store)
- **Facebook** (optional, good for travel demographic)
- **Email/Password** (fallback)

### Value-First Flow

1. User opens app → Can immediately create trips (stored locally)
2. After 1-2 trips → Prompt: "Sign in to save your trips across devices"
3. On sign in → Sync local trips to cloud
4. Seamless experience whether logged in or not

---

## Database Schema (Supabase/PostgreSQL)

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  destination TEXT NOT NULL,
  country TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  travelers INT DEFAULT 1,
  traveler_type TEXT,
  vibes TEXT[] DEFAULT '{}',
  budget TEXT,
  status TEXT DEFAULT 'draft', -- draft, generating, planned, active, completed
  cover_image TEXT,
  estimated_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Days
CREATE TABLE trip_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  date DATE NOT NULL,
  theme TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID REFERENCES trip_days(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  duration TEXT,
  type TEXT, -- activity, restaurant, transport, accommodation
  price TEXT,
  booking_url TEXT,
  affiliate_id TEXT,
  image_url TEXT,
  rating DECIMAL(2,1),
  review_count INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings (for affiliate tracking)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  activity_id UUID REFERENCES activities(id),
  affiliate_partner TEXT, -- legacy hotel supplier, viator, etc.
  affiliate_click_id TEXT,
  status TEXT DEFAULT 'clicked', -- clicked, booked, completed
  commission_amount DECIMAL(10,2),
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  booked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Row Level Security
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Users can only see their own trips
CREATE POLICY "Users can view own trips" ON trips
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips" ON trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips" ON trips
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## API Routes (Next.js App Router)

```
app/
├── api/
│   ├── trips/
│   │   ├── route.ts              # GET (list), POST (create)
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET, PUT, DELETE
│   │   │   └── generate/
│   │   │       └── route.ts      # POST - trigger AI generation
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts          # OAuth callback
│   │   └── sync/
│   │       └── route.ts          # Sync local trips to cloud
│   ├── bookings/
│   │   ├── click/
│   │   │   └── route.ts          # Track affiliate clicks
│   │   └── webhook/
│   │       └── route.ts          # Affiliate conversion webhooks
│   └── workflows/
│       └── generate-itinerary/
│           └── route.ts          # Vercel Workflow endpoint
```

---

## Vercel Workflows - Itinerary Generation

Long-running AI generation that can take 1-5 minutes:

```typescript
// app/api/workflows/generate-itinerary/route.ts
import { Workflow, WorkflowContext } from "@vercel/workflow";

export const workflow = new Workflow({
  id: "generate-itinerary",
  version: "1.0.0",
});

workflow.step("gather-destination-info", async (ctx: WorkflowContext) => {
  const { destination, dates, vibes } = ctx.input;

  // Fetch destination data (weather, events, local info)
  const destinationInfo = await fetchDestinationInfo(destination, dates);

  return { destinationInfo };
});

workflow.step("generate-itinerary-ai", async (ctx: WorkflowContext) => {
  const { destinationInfo, vibes, travelers, budget } = ctx.input;

  // Call the planning model to generate the itinerary
  const itinerary = await generateItinerary({
    destination: destinationInfo,
    preferences: { vibes, travelers, budget },
  });

  return { itinerary };
});

workflow.step("enrich-with-bookings", async (ctx: WorkflowContext) => {
  const { itinerary } = ctx.input;

  // Add booking links and real prices from affiliate APIs
  const enrichedItinerary = await enrichWithAffiliateData(itinerary);

  return { enrichedItinerary };
});

workflow.step("save-to-database", async (ctx: WorkflowContext) => {
  const { enrichedItinerary, tripId } = ctx.input;

  // Save to Supabase
  await saveTripToDatabase(tripId, enrichedItinerary);

  // Notify user via push notification
  await sendPushNotification(ctx.input.userId, "Your trip is ready!");

  return { success: true };
});

export const POST = workflow.handler();
```

### Client-Side Polling

```typescript
// In the mobile app
const generateTrip = async (tripInput: TripInput) => {
  // 1. Create trip in "generating" status
  const { tripId } = await api.post("/api/trips", {
    ...tripInput,
    status: "generating",
  });

  // 2. Trigger workflow
  const { workflowRunId } = await api.post(
    "/api/trips/" + tripId + "/generate",
  );

  // 3. Poll for completion (or use Supabase realtime)
  return new Promise((resolve) => {
    const subscription = supabase
      .channel("trip-" + tripId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.new.status === "planned") {
            subscription.unsubscribe();
            resolve(payload.new);
          }
        },
      )
      .subscribe();
  });
};
```

---

## Affiliate Integration

### Partners

| Partner                   | Category    | Commission | Integration   |
| ------------------------- | ----------- | ---------- | ------------- |
| the former hotel supplier | Hotels      | 4-6%       | Affiliate API |
| Viator                    | Experiences | 8%         | Affiliate API |
| GetYourGuide              | Tours       | 8%         | Affiliate API |
| Skyscanner                | Flights     | CPC        | Widget/API    |
| Klook                     | Activities  | 5-8%       | Affiliate API |

### Tracking Flow

```
User clicks "Book Now"
       │
       ▼
┌─────────────────┐
│ Track click in  │
│ bookings table  │
│ (affiliate_id)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redirect to     │
│ partner with    │
│ tracking params │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Partner webhook │
│ on conversion   │──── Update booking status
└─────────────────┘     + commission amount
```

---

## Project Structure

```
faroway-backend/
├── app/
│   ├── api/              # API routes
│   ├── layout.tsx
│   └── page.tsx          # Landing page (faroway.ai)
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # Browser client
│   │   ├── server.ts     # Server client
│   │   └── admin.ts      # Admin client (for workflows)
│   ├── ai/
│   │   └── prompts.ts    # Itinerary generation prompts
│   ├── affiliates/
│   │   ├── viator.ts     # Viator API
│   │   └── index.ts      # Unified affiliate interface
│   └── utils/
├── supabase/
│   ├── migrations/       # Database migrations
│   └── seed.sql          # Seed data
├── .env.local
├── next.config.js
├── package.json
└── vercel.json           # Workflow config
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI

# Affiliates
VIATOR_API_KEY=xxx
GETYOURGUIDE_API_KEY=xxx

# Vercel
VERCEL_WORKFLOW_SECRET=xxx
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [ ] Set up Next.js backend repo
- [ ] Configure Supabase project
- [ ] Create database schema
- [ ] Implement basic auth (Google + Apple)
- [ ] Trip CRUD API routes

### Phase 2: AI Generation (Week 2)

- [ ] Set up Vercel Workflows
- [ ] Implement the planning model itinerary generation
- [ ] Real-time status updates via Supabase
- [ ] Connect mobile app to backend

### Phase 3: Affiliates (Week 3)

- [ ] Integrate the former hotel supplier API
- [ ] Integrate Viator API
- [ ] Click tracking system
- [ ] Conversion webhook handlers

### Phase 4: Polish (Week 4)

- [ ] Push notifications
- [ ] Offline sync
- [ ] Analytics dashboard
- [ ] App Store submission

---

## Quick Start

```bash
# Clone and setup backend
npx create-next-app@latest faroway-backend --typescript --tailwind --app
cd faroway-backend

# Install dependencies

# Set up Supabase
npx supabase init
npx supabase db push

# Run locally
npm run dev
```

---

## Cost Estimates (Monthly)

| Service                | Free Tier          | Growth           |
| ---------------------- | ------------------ | ---------------- |
| Vercel                 | 100GB bandwidth    | $20/mo Pro       |
| Supabase               | 500MB DB, 50K auth | $25/mo Pro       |
| the former AI provider | Pay-per-use        | ~$50-200/mo      |
| **Total**              | **$0**             | **~$100-250/mo** |

Revenue potential: 4-8% commission on bookings. If users book $1000/trip average → $40-80 commission per trip.

---

_Ready to build! Start with Phase 1 when you give the go-ahead._ 🚀
