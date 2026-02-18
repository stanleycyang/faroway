# TripGenie Backend Scripts

This directory contains utility scripts for database testing, migrations, and other backend operations.

## Available Scripts

### `test-supabase.ts`

Comprehensive test suite for Supabase connection and Row Level Security (RLS) policies.

**Purpose**: Verifies that:
- Database connection works
- User profiles auto-create via auth trigger
- All tables are accessible
- RLS policies block unauthorized access
- Foreign key relationships work correctly

**Usage**:
```bash
# Using npm script (recommended)
npm run test:db

# Or directly with tsx
npx tsx scripts/test-supabase.ts
```

**Prerequisites**:
- `.env.local` configured with Supabase credentials
- Database migrations applied
- Valid `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)

**What it does**:
1. Tests database connection
2. Creates a test user via Supabase Auth
3. Verifies user profile auto-creation (via trigger)
4. Creates a test trip
5. Tests RLS by attempting unauthorized access
6. Creates test itinerary and saved activity
7. Cleans up all test data

**Expected output**:
```
╔════════════════════════════════════════════╗
║   TripGenie Supabase Connection Test      ║
╚════════════════════════════════════════════╝

✅ Database connection successful!
✅ Auth user created
✅ User profile created automatically via trigger
✅ Trip created successfully
✅ RLS working: Anonymous client cannot read user trips
✅ Itinerary created successfully
✅ Saved activity created successfully
✅ Test data cleaned up successfully

╔════════════════════════════════════════════╗
║       ✅ All tests passed!                 ║
╚════════════════════════════════════════════╝
```

**Troubleshooting**:
- **Connection failed**: Check `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- **User creation failed**: Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- **RLS not working**: Check policies in Supabase Dashboard → Database → Policies

## Adding New Scripts

When adding new scripts to this directory:

1. **Use TypeScript**: Name files `.ts` (not `.js`)
2. **Add shebang**: Start with `#!/usr/bin/env tsx` for direct execution
3. **Document**: Add description here and in file header
4. **Add npm script**: Add to `package.json` scripts for easy access
5. **Handle errors**: Use try-catch and exit codes
6. **Clean up**: Always clean up test data

### Template

```typescript
#!/usr/bin/env tsx
/**
 * Script description
 * 
 * Usage: npm run script-name
 * 
 * Prerequisites:
 * - List any requirements
 */

async function main() {
  try {
    // Your script logic here
    console.log('✅ Success!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
```

## Future Scripts (TODO)

Ideas for additional scripts:

- **`seed-database.ts`**: Populate database with sample data for development
- **`backup-database.ts`**: Export user data for backup
- **`migrate-data.ts`**: Data migration utilities
- **`analytics-report.ts`**: Generate usage statistics
- **`cleanup-old-trips.ts`**: Archive or delete old trips
- **`verify-rls.ts`**: Comprehensive RLS policy testing

## Development Notes

### Running Scripts in Development

```bash
# Watch mode (auto-rerun on changes)
npx tsx watch scripts/test-supabase.ts

# With debugging
NODE_ENV=development DEBUG=* npx tsx scripts/test-supabase.ts
```

### Environment Variables

Scripts can access environment variables from `.env.local`:
```typescript
import { config } from 'dotenv'
config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
```

### Database Access

**Use the right client**:
- **Admin/Service Role**: For admin operations, bypasses RLS
- **Anon/Public Key**: For testing RLS policies

```typescript
import { createClient } from '@supabase/supabase-js'

// Admin client (bypasses RLS)
const admin = createClient(url, serviceRoleKey)

// Regular client (respects RLS)
const anon = createClient(url, anonKey)
```

## Safety Guidelines

⚠️ **Important**:
- Always clean up test data
- Use test email domains (e.g., `@tripgenie.test`)
- Never commit `.env.local` with real credentials
- Use service role key only when necessary
- Add confirmation prompts for destructive operations

## Resources

- [tsx Documentation](https://github.com/esbuild-kit/tsx)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Node.js process.exit](https://nodejs.org/api/process.html#process_process_exit_code)

---

**Questions?** Check the main docs in `/backend/docs/` or Supabase dashboard logs.
