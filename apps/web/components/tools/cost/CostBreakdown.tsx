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
    color: "bg-primary",
  },
  {
    key: "food",
    label: "Food & Drinks",
    icon: UtensilsCrossed,
    color: "bg-amber-500",
  },
  {
    key: "transport",
    label: "Transport",
    icon: TrainFront,
    color: "bg-teal-500",
  },
  { key: "activities", label: "Activities", icon: Ticket, color: "bg-sky-500" },
  {
    key: "misc",
    label: "Miscellaneous",
    icon: ShoppingBag,
    color: "bg-slate-400",
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
      <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-primary-50 via-white to-amber-50 border border-slate-200/80 mb-8">
        <p className="text-sm text-slate-500 mb-1">
          Estimated total — {days} {days === 1 ? "day" : "days"}, {travelers}{" "}
          {travelers === 1 ? "traveler" : "travelers"} ({budgetLabel})
        </p>
        <div className="text-5xl font-bold text-slate-900 mb-1">
          {formatUSD(grandTotal)}
        </div>
        {profile.currency !== "USD" && (
          <p className="text-sm text-slate-400">
            {formatLocal(grandTotal)} {profile.currency}
          </p>
        )}
        <p className="text-sm text-slate-500 mt-2">
          ~{formatUSD(adjustedDaily)}/day per person
        </p>
      </div>

      {/* Category breakdown */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">Cost Breakdown</h2>
      <div className="space-y-4 mb-8">
        {CATEGORY_META.map(({ key, label, icon: Icon, color }) => {
          const pct = profile.breakdown[key as keyof typeof profile.breakdown];
          const amount = (totalPerPerson * pct) / 100;

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
                    <p className="text-sm font-semibold text-slate-900">
                      {label}
                    </p>
                    <p className="text-xs text-slate-500">{pct}% of budget</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {formatUSD(amount)}
                  </p>
                  {profile.currency !== "USD" && (
                    <p className="text-xs text-slate-400">
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

      {/* Sample prices */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        Sample Prices in {destinationName}
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {profile.samplePrices.map((sp) => (
          <div
            key={sp.item}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200/60"
          >
            <p className="text-xs text-slate-500 mb-1">{sp.item}</p>
            <p className="text-sm font-bold text-slate-900">
              {formatUSD(sp.priceUSD)}
              {profile.currency !== "USD" && (
                <span className="text-xs text-slate-400 font-normal ml-1">
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
      <p className="text-xs text-slate-400 text-center">
        Estimates based on average traveler data. Actual costs vary by season,
        booking choices, and personal spending.
      </p>
    </div>
  );
}
