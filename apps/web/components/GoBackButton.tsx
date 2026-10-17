"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

export function GoBackButton() {
  useEffect(() => {
    const failedPathname = window.location.pathname;
    function restorePage() {
      // Next's not-found boundary resets on pathname changes, but not when
      // history only changes an invalid page query back to a valid one.
      if (window.location.pathname === failedPathname) window.location.reload();
    }
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);

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
