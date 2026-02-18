# TripGenie AI Module

AI-powered travel itinerary generation using Anthropic's Claude API.

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create `.env.local` and add:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from: https://console.anthropic.com/

## Quick Start

```typescript
import { generateItinerary } from '@/lib/ai';

const itinerary = await generateItinerary({
  destination: 'Tokyo, Japan',
  startDate: '2026-03-15',
  endDate: '2026-03-20',
  budget: 'moderate',
  vibes: ['foodie', 'cultural', 'adventure'],
  travelers: { adults: 2, children: 0 },
});

console.log(itinerary.days); // Array of TripDay objects
```

## Features

✅ Complete day-by-day itinerary generation  
✅ Activity recommendations with vibe matching  
✅ Restaurant suggestions with dietary options  
✅ Real-time streaming progress updates  
✅ Cost estimation utilities  
✅ Structured TypeScript types  

## Usage Examples

See `EXAMPLE_USAGE.ts` for complete examples including:
- Full itinerary generation
- Activity-only generation
- Restaurant recommendations
- API route patterns
- Streaming responses
- React client integration

## Files

- `types.ts` - TypeScript definitions
- `prompts.ts` - Claude prompt templates
- `claude.ts` - Main API wrapper
- `index.ts` - Clean exports
- `README.md` - This file
- `EXAMPLE_USAGE.ts` - Code examples

## Next Steps

1. Run `npm install` to install @anthropic-ai/sdk
2. Create `.env.local` with your API key
3. Review `EXAMPLE_USAGE.ts` for integration patterns
4. Create API routes in `/app/api/itinerary/`
5. Connect to Supabase for data persistence

## Cost Estimation

Average 5-day itinerary: **$0.15-0.25** per generation

Claude Sonnet 4 pricing:
- Input: $3 per million tokens
- Output: $15 per million tokens

Use `estimateCost(inputTokens, outputTokens)` to track costs.

## Support

- Anthropic Docs: https://docs.anthropic.com/
- Claude Model: `claude-sonnet-4-20250514`
- Check EXAMPLE_USAGE.ts for patterns
