import type { SessionState } from "@/hooks/useSessionGuard";
import { ShieldAlert, LogOut, RefreshCw } from "lucide-react";

type Props = Pick<SessionState, "showWarning" | "warningMessage" | "remainingSeconds" | "onStayLoggedIn" | "onLogout">;

export default function SessionWarning({
  showWarning,
  warningMessage,
  remainingSeconds,
  onStayLoggedIn,
  onLogout,
}: Props) {
  if (!showWarning) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeDisplay = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;

  // Progress percentage (assume max 120 seconds for visual)
  const maxSecs = 120;
  const pct = Math.min(100, (remainingSeconds / maxSecs) * 100);
  const isUrgent = remainingSeconds <= 30;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl border bg-white shadow-2xl overflow-hidden"
        style={{
          borderColor: isUrgent ? "#ef4444" : "#e5e7eb",
          animation: "sessionWarningIn 0.3s ease-out",
        }}
      >
        {/* Top progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full transition-all duration-1000 ease-linear rounded-full"
            style={{
              width: `${pct}%`,
              background: isUrgent
                ? "linear-gradient(90deg, #ef4444, #f97316)"
                : "linear-gradient(90deg, #f59e0b, #eab308)",
            }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div
              className={`h-16 w-16 rounded-full flex items-center justify-center ${
                isUrgent ? "bg-red-50" : "bg-amber-50"
              }`}
              style={{
                animation: isUrgent ? "pulse 1.5s ease-in-out infinite" : undefined,
              }}
            >
              <ShieldAlert
                className={`h-8 w-8 ${isUrgent ? "text-red-500" : "text-amber-500"}`}
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-center text-lg font-bold text-gray-900 mb-2">
            Session Warning
          </h2>

          {/* Message */}
          <p className="text-center text-sm text-gray-600 mb-4">
            {warningMessage}
          </p>

          {/* Countdown */}
          <div className="flex justify-center mb-6">
            <div
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold ${
                isUrgent
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isUrgent ? "bg-red-400" : "bg-amber-400"
                  }`}
                  style={{ animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite" }}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    isUrgent ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
              </span>
              Auto-logout in <span className="font-mono tabular-nums text-base">{timeDisplay}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onStayLoggedIn}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" />
              Stay Logged In
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              <LogOut className="h-4 w-4" />
              Logout Now
            </button>
          </div>
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes sessionWarningIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
