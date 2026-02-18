/**
 * Environment variable validation for Next.js app.
 * Import this in layout.tsx or instrumentation.ts to validate at startup.
 */

import { z } from 'zod';

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required').optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  VERCEL_AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  WORKFLOW_WEBHOOK_SECRET: z.string().min(16, 'WORKFLOW_WEBHOOK_SECRET must be at least 16 chars').optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

let validated = false;

export function validateEnv() {
  if (validated) return;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment variables. Check server logs.');
    }
  }

  validated = true;
}
