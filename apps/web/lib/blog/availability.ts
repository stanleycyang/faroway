/**
 * Public blog reads must fail closed in production.
 *
 * `next build` sets NODE_ENV=production even on a laptop, so that flag is not
 * a production deploy. Vercel sets VERCEL_ENV=production only for production.
 * Local and preview builds without credentials may render empty blog lists.
 * A query error is never turned into an empty 200 or a 404.
 */

export const BLOG_DATABASE_UNCONFIGURED = "Blog database is not configured";

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function blogDatabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isBlogUnconfiguredError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(BLOG_DATABASE_UNCONFIGURED)
  );
}

export async function withBlogFallback<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!blogDatabaseConfigured()) {
    if (isProductionDeployment()) {
      throw new Error(
        `${BLOG_DATABASE_UNCONFIGURED} (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in production)`,
      );
    }
    return fallback;
  }

  try {
    return await read();
  } catch (error) {
    if (!isProductionDeployment() && isBlogUnconfiguredError(error)) {
      return fallback;
    }
    throw error;
  }
}
