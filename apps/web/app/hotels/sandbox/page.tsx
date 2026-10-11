import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLiteApiConfigured } from "@/lib/affiliates/liteapi";
import { HotelSandbox } from "./sandbox-form";

export default async function HotelSandboxPage() {
  if (process.env.VERCEL_ENV !== "preview" || !isLiteApiConfigured())
    notFound();
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/auth/login?redirectTo=/hotels/sandbox");
  return <HotelSandbox />;
}
