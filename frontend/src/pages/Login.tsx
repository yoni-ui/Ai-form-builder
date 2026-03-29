import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Wordmark } from "@/components/Wordmark";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up" | "magic";

export default function Login() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function afterAuthSession() {
    nav("/", { replace: true });
  }

  async function onPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMsg(friendlyAuthError(error.message));
      return;
    }
    await afterAuthSession();
  }

  async function onPasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== password2) {
      setMsg("Passwords do not match.");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    setMsg(null);
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      setMsg(friendlyAuthError(error.message));
      return;
    }
    if (data.session) {
      await afterAuthSession();
      return;
    }
    setMsg(
      "Account created, but no session yet. In Supabase → Authentication → Providers → Email, turn off Confirm email for instant sign-in without a confirmation step. Otherwise check your inbox to confirm.",
    );
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase client is not configured in the browser.");
      return;
    }
    setLoading(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setMsg(error.message);
    else setMsg("Check your email for the magic link.");
  }

  if (!supabaseConfigured) {
    return (
      <Layout>
        <div className="max-w-md mx-auto space-y-6">
          <Wordmark />
          <p className="text-zinc-600">
            Add <code className="text-sm bg-zinc-100 px-1 rounded">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> (e.g. in{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">frontend/.env.local</code>) to enable sign-in. The API
            should have <code className="text-sm bg-zinc-100 px-1 rounded">SUPABASE_JWT_SECRET</code> so your session is
            accepted on protected routes.
          </p>
          <p className="text-sm text-zinc-500">
            For local-only dev without Supabase in the browser, leave those unset; the API can use SQLite and{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">X-Dev-User-Id</code> when{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">SUPABASE_JWT_SECRET</code> is empty.
          </p>
          <Link to="/" className="text-violet-600 font-medium">
            ← Back home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>

        <div className="flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 text-sm font-medium">
          {(
            [
              ["sign-in", "Sign in"],
              ["sign-up", "Sign up"],
              ["magic", "Magic link"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setMsg(null);
              }}
              className={`flex-1 rounded-md py-2 transition-colors ${
                mode === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "sign-in" && (
          <form onSubmit={onPasswordSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-white font-medium hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {mode === "sign-up" && (
          <form onSubmit={onPasswordSignUp} className="space-y-4">
            <div>
              <label htmlFor="su-email" className="block text-sm font-medium text-zinc-700 mb-1">
                Email
              </label>
              <input
                id="su-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="su-password" className="block text-sm font-medium text-zinc-700 mb-1">
                Password
              </label>
              <input
                id="su-password"
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
            <div>
              <label htmlFor="su-password2" className="block text-sm font-medium text-zinc-700 mb-1">
                Confirm password
              </label>
              <input
                id="su-password2"
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-white font-medium hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {mode === "magic" && (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <div>
              <label htmlFor="ml-email" className="block text-sm font-medium text-zinc-700 mb-1">
                Email
              </label>
              <input
                id="ml-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-white font-medium hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Email me a magic link"}
            </button>
          </form>
        )}

        {msg && (
          <p className="text-sm text-zinc-600 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">{msg}</p>
        )}

        <button type="button" onClick={() => nav(-1)} className="text-sm text-violet-600">
          Back
        </button>
      </div>
    </Layout>
  );
}

function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Wrong email or password.";
  if (lower.includes("email not confirmed"))
    return "This email is not confirmed yet. In Supabase → Authentication → Providers → Email, disable Confirm email, or open the confirmation link from your inbox.";
  return raw;
}
