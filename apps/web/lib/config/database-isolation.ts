// Public project identities only. Never inspect or log credential values here.
const productionProject = "jcnephijkxgtprsutgsf";
export function assertDatabaseIsolation(env: {
  VERCEL_ENV?: string;
  FAROWAY_STAGING_SUPABASE_PROJECT_REF?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}) {
  if (env.VERCEL_ENV !== "preview" && env.VERCEL_ENV !== "development") return;
  const expected = env.FAROWAY_STAGING_SUPABASE_PROJECT_REF;
  let url: URL;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
  } catch {
    throw new Error(
      "An approved isolated Supabase target is required for non-production Vercel builds.",
    );
  }
  if (
    !expected ||
    !/^[a-z0-9]{20}$/.test(expected) ||
    expected === productionProject ||
    url.origin !== `https://${expected}.supabase.co` ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Non-production database isolation check failed. Configure an approved separate Supabase project; production reuse is blocked.",
    );
  }
}
