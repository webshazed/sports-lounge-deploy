import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AUTH_CHANGED_EVENT, isAuthed, notifyAuthChanged } from "@/lib/auth";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3b5998]/20 focus:border-[#3b5998]";
const labelClass = "block text-sm font-semibold text-slate-700 mb-2";

async function readJsonOrText<T>(res: Response): Promise<{ ok: true; json: T } | { ok: false; text: string }> {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text) as T };
  } catch {
    return { ok: false, text };
  }
}

async function signIn(emailOrUsername: string, password: string) {
  const res = await fetch("/api/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrUsername, password }),
  });
  const parsed = await readJsonOrText<
    { token: string; user: { id: number; email: string; username: string } } | { error: string; details?: string }
  >(res);
  if (!parsed.ok) {
    throw new Error(`Sign in failed (${res.status}). ${parsed.text.slice(0, 200)}`);
  }
  const data = parsed.json;
  if (!res.ok) throw new Error("error" in data ? data.error : "Sign in failed");
  return data as { token: string; user: { id: number; email: string; username: string } };
}

const SignIn = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const state = location.state as { emailOrUsername?: string } | null;
    if (state?.emailOrUsername) setEmailOrUsername(state.emailOrUsername);
    // only want to apply on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await signIn(emailOrUsername, password);
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      notifyAuthChanged();

      // Check subscription status before redirecting
      try {
        const subRes = await fetch("/api/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          if (!subData.subscription || subData.subscription.status !== "active") {
            // No active subscription — go to membership page
            if (subData.regType) {
              localStorage.setItem("reg_type", subData.regType);
            }
            toast.success(`Welcome back, ${user.username}! Please complete your membership.`);
            navigate("/membership");
            return;
          }
        }
      } catch {
        // If subscription check fails, still allow dashboard access
      }

      toast.success(`Welcome back, ${user.username}`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  if (isAuthed()) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-1/4 h-72 w-72 rounded-full bg-[#3b5998]/10 blur-3xl" />
          <div className="absolute bottom-10 right-1/4 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
        </div>
        <div className="container relative z-10 mx-auto px-6 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <p className="section-label section-label-with-lines mb-4">Account</p>
            <h1 className="font-body text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Sign In
            </h1>
            <p className="text-slate-600">Access your membership account.</p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 md:p-10"
          >
            <div>
              <label className={labelClass}>Email or Username</label>
              <input
                type="text"
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className={inputClass}
                placeholder="Email or Username"
                autoComplete="username"
              />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4">
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-sm text-slate-600 text-center">
              Don't have an account?{" "}
              <a href="/register" className="font-semibold text-[#1e346b] underline underline-offset-4">
                Register
              </a>
            </p>
          </motion.form>
        </div>
      </section>
      <Footer lightText />
    </div>
  );
};

export default SignIn;

