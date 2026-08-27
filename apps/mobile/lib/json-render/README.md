# json-render Integration for Faroway

This directory contains the json-render integration for generative UI in Faroway mobile app.

## Overview

json-render enables the AI backend to stream UI components that render natively in React Native, creating a dynamic and progressive user experience during itinerary generation.

## Architecture

### 1. Component Catalog (`catalog.ts`)

Defines all available components with Zod schemas for type safety:

- **TripSummary** - Overview card with destination, dates, travelers
- **HeroImage** - Large destination image
- **Section** - Section headers for organization
- **Text** - Styled text content
- **HotelCard** - Hotel/accommodation card with booking CTA
- **ItineraryDay** - Day container/header
- **ActivityCard** - Activity/attraction card
- **RestaurantCard** - Restaurant recommendation card
- **DayTimeline** - Vertical timeline overview
- **BookingButton** - Prominent booking CTA
- **PriceTag** - Styled price display
- **RatingStars** - Star rating component
- **MapPreview** - Location map preview

Each component has:

- Zod schema for props validation
- Description to guide AI usage
- Type safety via TypeScript

### 2. Component Registry (`registry.tsx`)

Maps catalog components to beautiful React Native implementations:

- Uses app's design system from `constants/theme.ts`
- Premium UI with shadows, gradients, rounded corners
- Handles deep linking via `expo-web-browser` for bookings
- Responsive and accessible components

### 3. Streaming Hook (`hooks/useStreamingItinerary.ts`)

Handles streaming itinerary data from backend:

- Creates or reuses a trip, then connects to `/api/trips/{tripId}/stream`
- Progressive document building as chunks arrive
- Reconnectable copy when a stream closes before completion
- Loading/error states and progress tracking

## Usage

### In Generating Screen

```tsx
import { useStreamingItinerary } from '../../hooks/useStreamingItinerary';
import { registry } from '../../lib/json-render/registry';

// Hook usage
const streamingState = useStreamingItinerary({
  input: {
    destination: 'Paris',
    startDate: '2024-03-15',
    endDate: '2024-03-22',
    travelers: 2,
    travelerType: 'couple',
    vibes: ['romantic', 'culture'],
    budget: 'moderate',
  },
  onComplete: (document) => {
    // Handle completion
  },
  onError: (error) => {
    // Handle errors
  },
});

// Render streaming document
<JsonRenderRenderer document={streamingState.document} />;
```

### Component Renderer

```tsx
function JsonRenderRenderer({ document }: { document: any }) {
  if (!document) return null;

  const renderComponent = (comp: any, index: number) => {
    const Component = registry[comp.type as keyof typeof registry];
    if (!Component) return null;
    return <Component key={index} {...(comp.props || {})} />;
  };

  const components = Array.isArray(document) ? document : [document];
  return <>{components.map(renderComponent)}</>;
}
```

## Backend Integration

The backend should stream json-render documents via Server-Sent Events (SSE):

### Streaming Endpoint

**GET** `/api/trips/{tripId}/stream`

The mobile hook creates a trip with `POST /api/trips` when needed, starts generation with `POST /api/trips/{tripId}/generate`, then opens the trip-scoped SSE stream.

**Response**: SSE stream with events:

```
event: progress
data: {"type":"progress","progress":25}

event: chunk
data: {"type":"chunk","chunk":[{"type":"TripSummary","props":{"destination":"Paris",...}}]}

event: chunk
data: {"type":"chunk","chunk":[{"type":"HotelCard","props":{"name":"Hotel Plaza Athénée",...}}]}

event: complete
data: {"type":"complete","document":[...full document...]}
```

### Document Structure

```typescript
interface JsonRenderDocument {
  type: string;
  props: Record<string, any>;
}

// Example
[
  {
    type: 'TripSummary',
    props: {
      destination: 'Paris',
      dates: 'Mar 15 - Mar 22, 2024',
      travelers: 2,
      budget: 'moderate',
    },
  },
  {
    type: 'HotelCard',
    props: {
      name: 'Hotel Plaza Athénée',
      rating: 4.8,
      pricePerNight: 850,
      amenities: ['WiFi', 'Spa', 'Restaurant'],
      bookingUrl: 'https://booking.com/...',
    },
  },
  {
    type: 'ItineraryDay',
    props: {
      dayNumber: 1,
      date: '2024-03-15',
      title: 'Arrival & Eiffel Tower',
    },
  },
  {
    type: 'ActivityCard',
    props: {
      name: 'Eiffel Tower Summit',
      description: 'Skip-the-line access to the summit',
      duration: '2 hours',
      price: 45,
      rating: 4.9,
      reviewCount: 12847,
      time: '10:00',
      bookingUrl: 'https://viator.com/...',
    },
  },
];
```

## Recovery Strategy

When a stream closes before completion, the hook preserves the created `tripId` and returns reconnect-oriented error copy so the user can retry without creating a duplicate trip. Network/setup failures are surfaced as user-facing errors instead of silently falling back to stale polling semantics.

## Future Enhancements

1. **Persistent Storage** - Store json-render documents in the trip store
2. **Offline Support** - Cache documents for offline viewing
3. **Map Integration** - Replace placeholder with react-native-maps
4. **Custom Animations** - Add entrance animations per component
5. **Interactive Components** - Add collapsible sections, carousels
6. **A/B Testing** - Compare json-render vs traditional rendering

## Development

### Adding New Components

1. Define schema in `catalog.ts`:

```typescript
export const MyComponentSchema = z.object({
  title: z.string(),
  // ...
});

export const MyComponent = {
  name: 'MyComponent',
  schema: MyComponentSchema,
  description: 'What this component does...',
};
```

2. Implement UI in `registry.tsx`:

```typescript
export const MyComponent: React.FC<MyComponentProps> = (props) => {
  return (
    <View style={styles.myComponent}>
      {/* UI implementation */}
    </View>
  );
};
```

3. Add to exports and update types

### Testing

Test streaming with mock server:

```bash
npm run mock-server
```

Then run the app and create a new trip.

## Credits

Built with:

- [json-render](https://github.com/json-render/json-render) - Component streaming framework
- [Zod](https://zod.dev) - Schema validation
- [Expo](https://expo.dev) - React Native framework
