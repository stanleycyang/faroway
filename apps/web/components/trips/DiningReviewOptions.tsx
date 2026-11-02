import { readDiningReviewOptions } from "@faroway/types";

export function DiningReviewOptions({ options }: { options: unknown }) {
  const items = readDiningReviewOptions(options);
  if (!items.length) return null;
  return (
    <section
      className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
      aria-label="Dining options to review"
    >
      <h3 className="text-base font-semibold text-slate-900">
        Dining options to review
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        These options are not scheduled. Check meal service, prices and
        availability before choosing one.
      </p>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl bg-white p-4">
            <h4 className="font-semibold text-slate-900">{item.name}</h4>
            <p className="mt-1 text-sm text-slate-600">{item.address}</p>
            <a
              className="mt-2 inline-flex min-h-11 items-center break-all text-sm font-medium text-slate-900 underline underline-offset-2"
              href={item.source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View source · {new URL(item.source.url).hostname}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-xs text-slate-500">
              Retrieved {item.source.retrievedOn}. Venue details still need
              checking.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
