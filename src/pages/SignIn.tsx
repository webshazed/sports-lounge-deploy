import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AUTH_CHANGED_EVENT, isAuthed, notifyAuthChanged } from "@/lib/auth";

const inputClass =
  "w-full bg-card border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground mb-2";

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
    <div className="min-h-screen bg-background">
      <Header />
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <p className="section-label section-label-with-lines mb-4">Account</p>
            <h1 className="font-body text-4xl md:text-5xl font-bold text-foreground mb-4">
              Sign In
            </h1>
            <p className="text-muted-foreground">Access your membership account.</p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6"
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

            <p className="text-sm text-muted-foreground text-center">
              Don’t have an account?{" "}
              <a href="/register" className="underline underline-offset-4">
                Register
              </a>
            </p>
          </motion.form>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default SignIn;

