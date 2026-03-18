import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed } from "@/lib/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}

