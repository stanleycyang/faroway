"use client";

import { useState } from "react";
import { Shield, Clock, Info, AlertTriangle } from "lucide-react";
import { getAllGuides } from "@/lib/destination-guides";
import {
  passportCountries,
  getVisaInfo,
  visaStatusConfig,
  type VisaStatus,
} from "@/lib/tools/visa-data";
import { ToolHero } from "@/components/tools/ToolHero";

const guides = getAllGuides();

const STATUS_ICONS: Record<VisaStatus, typeof Shield> = {
  "visa-free": Shield,
  "visa-on-arrival": Clock,
  "e-visa": Info,
  "visa-required": AlertTriangle,
};

export function VisaCheckerClient() {
  const [passportCode, setPassportCode] = useState("");
  const [destinationSlug, setDestinationSlug] = useState("");

  const visaInfo =
    passportCode && destinationSlug
      ? getVisaInfo(passportCode, destinationSlug)
      : null;

  const destination = guides.find((g) => g.slug === destinationSlug);
  const passport = passportCountries.find((p) => p.code === passportCode);

  return (
    <div>
      <ToolHero
        badge="Free Tool"
        title="Visa Checker"
        gradientWord="Visa"
        description="Check general visa guidance for 40+ popular destinations based on your passport country. Always verify requirements with an official authority before travel."
      />

      <section className="max-w-xl mx-auto px-6 pb-16">
        {/* Passport Country */}
        <div className="mb-6">
          <label
            htmlFor="visa-passport"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Your Passport
          </label>
          <select
            id="visa-passport"
            value={passportCode}
            onChange={(e) => setPassportCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            <option value="">Select your passport country</option>
            {passportCountries.map((p) => (
              <option key={p.code} value={p.code}>
                {p.flag} {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div className="mb-8">
          <label
            htmlFor="visa-destination"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Destination
          </label>
          <select
            id="visa-destination"
            value={destinationSlug}
            onChange={(e) => setDestinationSlug(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            <option value="">Select a destination</option>
            {guides.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}, {g.country}
              </option>
            ))}
          </select>
        </div>

        {/* Result Card */}
        {visaInfo && destination && passport && (
          <div
            role="status"
            aria-live="polite"
            className="animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <div
              className={`rounded-2xl border-2 ${visaStatusConfig[visaInfo.status].border} ${visaStatusConfig[visaInfo.status].bg} p-6 mb-6`}
            >
              {/* Status Badge */}
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const StatusIcon = STATUS_ICONS[visaInfo.status];
                  return (
                    <div
                      className={`w-12 h-12 rounded-xl ${visaStatusConfig[visaInfo.status].bg} border ${visaStatusConfig[visaInfo.status].border} flex items-center justify-center`}
                    >
                      <StatusIcon
                        className={`w-6 h-6 ${visaStatusConfig[visaInfo.status].color}`}
                      />
                    </div>
                  );
                })()}
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${visaStatusConfig[visaInfo.status].color} ${visaStatusConfig[visaInfo.status].bg} border ${visaStatusConfig[visaInfo.status].border}`}
                  >
                    {visaStatusConfig[visaInfo.status].label}
                  </span>
                </div>
              </div>

              {/* Details */}
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                {passport.flag} {passport.name} → {destination.name}
              </h2>

              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Stay Duration
                    </p>
                    <p className="text-sm text-slate-600">
                      {visaInfo.duration}
                    </p>
                  </div>
                </div>

                {visaInfo.notes && (
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Notes
                      </p>
                      <p className="text-sm text-slate-600">{visaInfo.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong>Disclaimer:</strong> Visa requirements change
                frequently. Always verify with your country&apos;s embassy or
                the destination&apos;s immigration authority before traveling.
                This tool provides general guidance only and should not be
                relied upon as legal advice.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!passportCode || !destinationSlug) && (
          <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Select your passport and destination to check visa requirements
            </p>
          </div>
        )}

        {passportCode && destinationSlug && !visaInfo && (
          <div
            role="status"
            className="rounded-2xl border border-slate-200 p-6 text-center"
          >
            <h2 className="font-semibold text-slate-900">
              Guidance unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              We do not have guidance for this combination yet. Check the
              destination&apos;s official immigration authority before travel.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
