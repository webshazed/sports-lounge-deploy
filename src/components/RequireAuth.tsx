import React, { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed } from "@/lib/auth";
import { toast } from "sonner";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const toasted = useRef(false);

  const authed = isAuthed(); // now also checks token expiry

  useEffect(() => {
    if (!authed && !toasted.current) {
      toasted.current = true;
      toast.error("Session expired — please sign in again.");
    }
  }, [authed]);

  if (!authed) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
