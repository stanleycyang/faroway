import type { CostProfile } from "@/lib/tools/cost-data";
import {
  Bed,
  UtensilsCrossed,
  TrainFront,
  Ticket,
  ShoppingBag,
} from "lucide-react";

interface CostBreakdownProps {
  profile: CostProfile;
  dailyBudget: number;
  days: number;
  travelers: number;
  budgetLabel: string;
  destinationName: string;
}

const CATEGORY_META = [
  {
    key: "accommodation",
    label: "Accommodation",
    icon: Bed,
    color: "bg-primary-700",
  },
  {
    key: "food",
    label: "Food & Drinks",
    icon: UtensilsCrossed,
    color: "bg-amber-600",
  },
  {
    key: "transport",
    label: "Transport",
    icon: TrainFront,
    color: "bg-[#143D46]",
  },
  { key: "activities", label: "Activities", icon: Ticket, color: "bg-sky-700" },
  {
    key: "misc",
    label: "Miscellaneous",
    icon: ShoppingBag,
    color: "bg-slate-600",
  },
] as const;

export function CostBreakdown({
  profile,
  dailyBudget,
  days,
  travelers,
  budgetLabel,
  destinationName,
}: CostBreakdownProps) {
  const adjustedDaily = dailyBudget * profile.costMultiplier;
  const totalPerPerson = adjustedDaily * days;
  const grandTotal = totalPerPerson * travelers;

  const formatUSD = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const formatLocal = (n: number) => {
    if (profile.currency === "USD") return "";
    const local = n * profile.exchangeRate;
    return `${profile.currencySymbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(local)}`;
  };

  return (
    <div>
      {/* Total hero */}
      <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-[#FAF8F3] via-white to-[#EFF5F3] border border-[#DCE5E3] mb-8">
        <p className="text-sm text-slate-600 mb-1">
          Estimated total — {days} {days === 1 ? "day" : "days"}, {travelers}{" "}
          {travelers === 1 ? "traveler" : "travelers"} ({budgetLabel})
        </p>
        <div className="text-5xl font-bold text-slate-900 mb-1">
          {formatUSD(grandTotal)}
        </div>
        {profile.currency !== "USD" && (
          <p className="text-sm text-slate-600">
            {formatLocal(grandTotal)} {profile.currency}
          </p>
        )}
        <p className="text-sm text-slate-600 mt-2">
          ~{formatUSD(adjustedDaily)}/day per person
        </p>
      </div>

      {/* Category breakdown */}
      <section aria-labelledby="cost-breakdown-heading">
        <h2
          id="cost-breakdown-heading"
          className="text-lg font-bold text-slate-900 mb-2"
        >
          Cost Breakdown
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          For {travelers === 1 ? "one traveler" : `all ${travelers} travelers`}{" "}
          across {days} {days === 1 ? "day" : "days"}.
        </p>
        <div className="space-y-4 mb-8">
          {CATEGORY_META.map(({ key, label, icon: Icon, color }) => {
            const pct =
              profile.breakdown[key as keyof typeof profile.breakdown];
            const amount = (grandTotal * pct) / 100;

            return (
              <div
                key={key}
                className="p-4 rounded-xl bg-white border border-slate-200/80"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${color} text-white flex items-center justify-center`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {label}
                      </h3>
                      <p className="text-xs text-slate-600">{pct}% of budget</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {formatUSD(amount)}
                    </p>
                    {profile.currency !== "USD" && (
                      <p className="text-xs text-slate-600">
                        {formatLocal(amount)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sample prices */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        Sample Prices in {destinationName}
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {profile.samplePrices.map((sp) => (
          <div
            key={sp.item}
            className="p-3 rounded-xl bg-[#FAF8F3] border border-[#DCE5E3]"
          >
            <p className="text-xs text-slate-600 mb-1">{sp.item}</p>
            <p className="text-sm font-bold text-slate-900">
              {formatUSD(sp.priceUSD)}
              {profile.currency !== "USD" && (
                <span className="text-xs text-slate-600 font-normal ml-1">
                  ({profile.currencySymbol}
                  {Math.round(
                    sp.priceUSD * profile.exchangeRate,
                  ).toLocaleString()}
                  )
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 text-center">
        Estimates based on average traveler data. Actual costs vary by season,
        booking choices, and personal spending.
      </p>
    </div>
  );
}
