import { useEffect, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  isAuthed,
  isTokenExpired,
  isTokenExpiringSoon,
  getTokenRemainingMs,
  getIdleMs,
  recordActivity,
  logout,
  notifyAuthChanged,
  refreshToken,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_BEFORE_MS,
  EXPIRY_CHECK_INTERVAL_MS,
  TOKEN_WARNING_THRESHOLD_MS,
} from "@/lib/auth";

export type SessionState = {
  /** Whether the session-warning modal should be visible */
  showWarning: boolean;
  /** Message to show in the warning */
  warningMessage: string;
  /** Seconds remaining (for countdown display) */
  remainingSeconds: number;
  /** Dismiss the warning and stay logged in */
  onStayLoggedIn: () => void;
  /** Confirm logout */
  onLogout: () => void;
};

/**
 * Session guard hook — manages idle timeout, token expiry checks,
 * and tab-visibility checks.  Mount once in App or layout.
 */
export function useSessionGuard(): SessionState {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningShownRef = useRef(false);

  /* ── helpers ───────────────────────────────────────── */

  const doLogout = useCallback(() => {
    setShowWarning(false);
    warningShownRef.current = false;
    if (countdownRef.current) clearInterval(countdownRef.current);
    logout();
    notifyAuthChanged();
    toast.error("You have been logged out.");
    if (
      window.location.pathname !== "/signin" &&
      window.location.pathname !== "/register" &&
      window.location.pathname !== "/"
    ) {
      window.location.href = "/signin";
    }
  }, []);

  const onStayLoggedIn = useCallback(async () => {
    setShowWarning(false);
    warningShownRef.current = false;
    if (countdownRef.current) clearInterval(countdownRef.current);
    recordActivity();

    // Try to refresh token so user gets a fresh 7 days
    const ok = await refreshToken();
    if (ok) {
      toast.success("Session extended successfully.");
    } else {
      toast.info("Activity recorded — session continues.");
    }
  }, []);

  const onLogout = useCallback(() => {
    doLogout();
  }, [doLogout]);

  /* ── start countdown (used for both idle + token expiry warnings) */

  const startCountdown = useCallback(
    (seconds: number, message: string) => {
      if (warningShownRef.current) return; // already showing
      warningShownRef.current = true;
      setWarningMessage(message);
      setRemainingSeconds(seconds);
      setShowWarning(true);

      if (countdownRef.current) clearInterval(countdownRef.current);
      let secs = seconds;
      countdownRef.current = setInterval(() => {
        secs -= 1;
        setRemainingSeconds(secs);
        if (secs <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          doLogout();
        }
      }, 1000);
    },
    [doLogout]
  );

  /* ── periodic check ─────────────────────────────────── */

  useEffect(() => {
    if (!isAuthed()) return;

    // Record initial activity
    recordActivity();

    // Activity listeners — record mouse/keyboard/touch/scroll
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    let lastRecorded = 0;
    const onActivity = () => {
      // Throttle to once per 10 seconds to avoid localStorage spam
      const now = Date.now();
      if (now - lastRecorded > 10_000) {
        lastRecorded = now;
        recordActivity();
      }
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    // Periodic check
    const interval = setInterval(() => {
      if (!isAuthed()) {
        // Token gone or expired while we were running
        doLogout();
        return;
      }

      // Check token expiry
      if (isTokenExpired()) {
        doLogout();
        return;
      }

      // Token expiring soon?
      if (isTokenExpiringSoon(TOKEN_WARNING_THRESHOLD_MS) && !warningShownRef.current) {
        const secs = Math.ceil(getTokenRemainingMs() / 1000);
        startCountdown(secs, "Your session is about to expire.");
        return;
      }

      // Idle timeout check
      const idleMs = getIdleMs();
      if (idleMs >= IDLE_TIMEOUT_MS) {
        doLogout();
        return;
      }

      // Idle warning (28 min → show 2-min warning)
      const warningThreshold = IDLE_TIMEOUT_MS - IDLE_WARNING_BEFORE_MS;
      if (idleMs >= warningThreshold && !warningShownRef.current) {
        const secsLeft = Math.ceil((IDLE_TIMEOUT_MS - idleMs) / 1000);
        startCountdown(secsLeft, "You've been inactive. You will be logged out soon.");
      }
    }, EXPIRY_CHECK_INTERVAL_MS);

    // Tab visibility — check token when user comes back to the tab
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!isAuthed() || isTokenExpired()) {
          doLogout();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Listen for session-expired events from the API interceptor
    const onSessionExpired = () => {
      doLogout();
    };
    window.addEventListener("session-expired", onSessionExpired);

    return () => {
      clearInterval(interval);
      if (countdownRef.current) clearInterval(countdownRef.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("session-expired", onSessionExpired);
    };
  }, [doLogout, startCountdown]);

  return { showWarning, warningMessage, remainingSeconds, onStayLoggedIn, onLogout };
}
