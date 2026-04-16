import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type SubStatus = "loading" | "active" | "inactive";

/**
 * Route guard that requires both authentication AND an active subscription.
 * If the user is authenticated but has no active subscription, redirects to /membership.
 */
export default function RequireSubscription({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<SubStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const data = await apiFetch<{
          subscription: { status: string } | null;
          regType: string;
        }>("/api/subscription");

        if (cancelled) return;

        if (data.subscription?.status === "active") {
          setStatus("active");
        } else {
          // Store regType for the membership page
          if (data.regType) {
            localStorage.setItem("reg_type", data.regType);
          }
          setStatus("inactive");
        }
      } catch {
        if (!cancelled) setStatus("inactive");
      }
    }

    if (isAuthed()) {
      check();
    } else {
      setStatus("inactive");
    }

    return () => { cancelled = true; };
  }, [location.pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (status === "inactive") {
    return <Navigate to="/membership" replace state={{ from: location.pathname }} />;
  }

  return children;
}
