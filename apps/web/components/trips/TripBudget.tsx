import React from "react";
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
      <p className="text-sm text-gray-600">
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
      color: "bg-blue-500",
      bgColor: "bg-blue-50 text-blue-700",
      icon: "🏨",
    },
    {
      label: "Activities & Tours",
      amount: breakdown.activities,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50 text-emerald-700",
      icon: "🎯",
    },
    {
      label: "Dining",
      amount: breakdown.dining,
      color: "bg-orange-500",
      bgColor: "bg-orange-50 text-orange-700",
      icon: "🍽️",
    },
    {
      label: "Transport",
      amount: breakdown.transport,
      color: "bg-sky-500",
      bgColor: "bg-sky-50 text-sky-700",
      icon: "✈️",
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
              <span className="text-lg">{cat.icon}</span>
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

      <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between">
        <span className="font-bold text-gray-900">
          Listed estimate subtotal
        </span>
        <span className="text-2xl font-black text-gray-900">
          {formatCost(breakdown.total)}
        </span>
      </div>
    </div>
  );
}
