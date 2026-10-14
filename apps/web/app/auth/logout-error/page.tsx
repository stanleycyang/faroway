import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check your sign-out",
  robots: { index: false, follow: false },
};

export default function LogoutRecoveryPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <h1 className="font-editorial text-3xl text-slate-900">
          Sign-out wasn’t confirmed
        </h1>
        <p className="mt-4 leading-relaxed text-slate-600">
          We couldn’t confirm that your session ended. Try signing out again,
          especially if you’re using a shared device.
        </p>
        <form action="/auth/logout" method="post" className="mt-7">
          <button className="min-h-12 w-full rounded-full bg-slate-900 px-6 py-3 font-semibold text-white">
            Try signing out again
          </button>
        </form>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline underline-offset-4"
        >
          Check my session
        </Link>
      </section>
    </main>
  );
}
