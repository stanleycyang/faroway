import Link from "next/link";

/** Missing and revoked links share one recovery state without exposing ownership. */
export default function SharedTripNotFound() {
  return (
    <main
      aria-labelledby="shared-link-unavailable-title"
      className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-12"
    >
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          A shared journey
        </p>
        <h1
          id="shared-link-unavailable-title"
          className="font-editorial text-3xl leading-tight text-slate-900 sm:text-4xl"
        >
          This shared trip isn’t available
        </h1>
        <p className="mt-4 leading-relaxed text-slate-600">
          The link may have been turned off or copied incorrectly. Ask the
          traveler for a current link, or start a journey of your own.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/create"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Plan your own journey
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Faroway home
          </Link>
        </div>
      </section>
    </main>
  );
}
