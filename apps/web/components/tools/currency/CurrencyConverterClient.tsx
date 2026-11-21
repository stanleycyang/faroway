"use client";

import { useState } from "react";
import { ArrowLeftRight, Lightbulb } from "lucide-react";
import { isAllowedAffiliateUrl } from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import {
  convertCurrency,
  currencies,
  getCurrencyByCode,
} from "@/lib/tools/currency-data";
import { ToolHero } from "@/components/tools/ToolHero";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";
import { ToolAffiliateCard } from "@/components/tools/ToolAffiliateCard";

const QUICK_AMOUNTS = [50, 100, 500, 1000];

export interface CurrencyConverterClientProps {
  wisePairLinks?: Record<string, AffiliateLinkResult>;
  wiseBaseLink?: AffiliateLinkResult | null;
}

export function CurrencyConverterClient({
  wisePairLinks,
  wiseBaseLink,
}: CurrencyConverterClientProps = {}) {
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("EUR");
  const [amount, setAmount] = useState<string>("100");

  const numericAmount = Math.max(0, parseFloat(amount) || 0);
  const converted = convertCurrency(numericAmount, fromCode, toCode);
  const fromCurrency = getCurrencyByCode(fromCode);
  const toCurrency = getCurrencyByCode(toCode);

  const handleSwap = () => {
    setFromCode(toCode);
    setToCode(fromCode);
  };

  const formatNumber = (n: number) => {
    if (n >= 10000)
      return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (n >= 100)
      return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (n > 0 && n < 0.01)
      return n.toLocaleString("en-US", { maximumFractionDigits: 5 });
    if (n > 0 && n < 1)
      return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };

  // Show tips for whichever currency is not USD (or the "to" currency by default)
  const tipsCurrency =
    toCode !== "USD" ? toCurrency : fromCode !== "USD" ? fromCurrency : null;

  const pairLink =
    wisePairLinks?.[`${fromCode}-${toCode}`] ?? wiseBaseLink ?? null;
  const validPairLink =
    pairLink?.url && isAllowedAffiliateUrl(pairLink.url) ? pairLink : null;

  return (
    <main className="min-h-screen">
      <ToolHero
        badge="Free Tool"
        title="Currency Converter"
        gradientWord="Currency"
        description="Convert between 11 travel currencies with approximate exchange rates. Includes destination-specific tips for handling money abroad."
      />

      <section className="max-w-xl mx-auto px-6 pb-16">
        {/* Currency Pickers */}
        <div className="flex items-end gap-3 mb-6">
          <div className="flex-1">
            <label
              htmlFor="currency-from"
              className="block text-sm font-semibold text-slate-900 mb-3"
            >
              From
            </label>
            <select
              id="currency-from"
              value={fromCode}
              onChange={(e) => setFromCode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-[#EFF5F3] hover:border-primary-700/40 transition-all mb-0.5"
            aria-label="Swap currencies"
          >
            <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="flex-1">
            <label
              htmlFor="currency-to"
              className="block text-sm font-semibold text-slate-900 mb-3"
            >
              To
            </label>
            <select
              id="currency-to"
              value={toCode}
              onChange={(e) => setToCode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label
            htmlFor="currency-amount"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-medium">
              {fromCurrency?.symbol}
            </span>
            <input
              id="currency-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="any"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
              placeholder="Enter amount"
            />
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="flex gap-2 mb-8">
          {QUICK_AMOUNTS.map((qa) => (
            <button
              type="button"
              key={qa}
              onClick={() => setAmount(qa.toString())}
              aria-pressed={amount === qa.toString()}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                amount === qa.toString()
                  ? "bg-primary-50 text-primary-800 border border-primary-700"
                  : "bg-white text-slate-700 border border-[#DCE5E3] hover:border-primary-700/40"
              }`}
            >
              {fromCurrency?.symbol}
              {qa.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Conversion Result */}
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl bg-gradient-to-br from-[#FAF8F3] to-[#EFF5F3] border border-[#DCE5E3] p-6 mb-6 text-center"
        >
          <p className="text-sm text-slate-600 mb-1 inline-flex items-center justify-center gap-1.5">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-white border border-[#DCE5E3] text-[#143D46]">
              {fromCode}
            </span>
            <span>
              {formatNumber(numericAmount)} {fromCode} =
            </span>
          </p>
          <p className="text-4xl font-bold text-slate-900 mb-1">
            {toCurrency?.symbol} {formatNumber(converted)}
          </p>
          <p className="text-sm text-slate-600 inline-flex items-center justify-center gap-1.5">
            <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-white border border-[#DCE5E3] text-[#143D46]">
              {toCode}
            </span>
            <span>{toCurrency?.name}</span>
          </p>
          <p className="mt-2 text-xs font-medium text-slate-600">
            Planning estimate — rates are not live.
          </p>
          <div className="mt-3 pt-3 border-t border-[#DCE5E3]">
            <p className="text-xs text-slate-600">
              1 {fromCode} ={" "}
              {formatNumber(convertCurrency(1, fromCode, toCode))} {toCode}
              {" · "}1 {toCode} ={" "}
              {formatNumber(convertCurrency(1, toCode, fromCode))} {fromCode}
            </p>
          </div>
        </div>

        {validPairLink && (
          <ToolAffiliateCard
            title={`Send or spend ${toCode} with Wise`}
            subtitle={`Check live ${fromCode} to ${toCode} mid-market rates and transparent transfer fees.`}
            placement="currency_result"
            campaign="tool-currency-converter"
            actions={[
              {
                key: `tool-currency-${fromCode}-${toCode}-wise`,
                link: {
                  ...validPairLink,
                  label: `Send or spend ${toCode} at the mid-market rate with Wise`,
                },
                itemType: "activity",
              },
            ]}
            editorialNote="Live FX rates, transfer fees, and card terms are set by Wise and vary by country; verify current pricing directly on Wise."
            className="mb-6"
          />
        )}

        {/* Tips Card */}
        {tipsCurrency && tipsCurrency.tips.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#DCE5E3] p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb
                className="w-5 h-5 text-[#C03A31]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold text-slate-900">
                Tips for {tipsCurrency.name} ({tipsCurrency.code})
              </h2>
            </div>
            <ul className="space-y-2">
              {tipsCurrency.tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  <span className="text-primary-700 mt-0.5" aria-hidden="true">
                    •
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer */}
        <div className="rounded-xl bg-[#FAF8F3] border border-[#DCE5E3] p-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>Disclaimer:</strong> Exchange rates are approximate and for
            reference only. Actual rates may vary depending on your bank, card
            provider, or exchange service. Always check current rates before
            making financial decisions.
          </p>
        </div>
      </section>

      <RelatedTools currentSlug="currency-converter" />
      <ToolCTA />
    </main>
  );
}
