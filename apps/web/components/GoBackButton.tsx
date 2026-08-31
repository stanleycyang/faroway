"use client";

import { ArrowLeft } from "lucide-react";

export function GoBackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="mt-6 inline-flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-700"
    >
      <ArrowLeft className="h-4 w-4" />
      Go back to previous page
    </button>
  );
}
