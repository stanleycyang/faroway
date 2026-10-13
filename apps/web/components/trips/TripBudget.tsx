import React from "react";
import { Hotel, Compass, Utensils, Plane } from "lucide-react";
import {
  formatEstimate,
  type CurrencyBudget,
  type summarizeBudget,
} from "@/lib/trips/budget";

export function TripBudget({
  budget,
  travelers,
}: {
  budget: ReturnType<typeof summarizeBudget>;
  travelers: number;
}) {
  return (
    <section aria-label="Planning budget" className="mt-6">
      <h2 className="mb-4 font-editorial text-2xl text-slate-900 sm:text-3xl">
        Your planning budget
      </h2>
      <p className="text-sm leading-7 text-slate-600">
        Planning estimates, not a booking quote. Meals marked per person include{" "}
        {travelers} travelers. Hotel room count and activity or transport party
        pricing are unconfirmed. Taxes, fees and missing items may add to the
        cost. Currencies are shown separately without conversion.
      </p>
      {budget.unknownItems > 0 && (
        <p className="mt-2 text-sm text-amber-800">
          {budget.unknownItems} item(s) have unknown prices and are excluded.
        </p>
      )}
      {budget.groups.map((group) => (
        <BudgetSummary
          key={group.currency}
          breakdown={group}
          currency={group.currency}
        />
      ))}
    </section>
  );
}

// ── Budget Summary Component ─────────────────────────────────────────────────

function BudgetSummary({
  breakdown,
  currency,
}: {
  breakdown: CurrencyBudget;
  currency: string;
}) {
  const formatCost = (amount: number) => formatEstimate(amount, currency);

  const categories = [
    {
      label: "Accommodation",
      amount: breakdown.accommodation,
      color: "bg-slate-800",
      bgColor: "bg-blue-50 text-blue-700",
      icon: Hotel,
    },
    {
      label: "Activities & Tours",
      amount: breakdown.activities,
      color: "bg-slate-600",
      bgColor: "bg-emerald-50 text-emerald-700",
      icon: Compass,
    },
    {
      label: "Dining",
      amount: breakdown.dining,
      color: "bg-slate-400",
      bgColor: "bg-orange-50 text-orange-700",
      icon: Utensils,
    },
    {
      label: "Transport",
      amount: breakdown.transport,
      color: "bg-slate-300",
      bgColor: "bg-sky-50 text-sky-700",
      icon: Plane,
    },
  ].filter((c) => c.amount > 0);

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-bold text-gray-900 mb-5 text-lg">
        Listed estimates · {currency}
      </h3>

      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-5 bg-gray-100">
        {categories.map((cat) => (
          <div
            key={cat.label}
            className={`${cat.color} transition-all first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(cat.amount / breakdown.total) * 100}%` }}
          />
        ))}
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.label} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <cat.icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="text-sm text-gray-600 font-medium">
                {cat.label}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {formatCost(cat.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap gap-3 items-center justify-between">
        <span className="font-bold text-gray-900">
          Listed estimate subtotal
        </span>
        <span className="text-2xl font-semibold text-slate-900">
          {formatCost(breakdown.total)}
        </span>
      </div>
    </div>
  );
}
