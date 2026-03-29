import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Wordmark } from "@/components/Wordmark";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

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
            Auth is optional for local development. Forms and responses are stored in{" "}
            <strong>local SQLite</strong> when <code className="text-sm bg-zinc-100 px-1 rounded">SUPABASE_URL</code> /{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> are unset on the API. For magic links, set{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>. Without{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">SUPABASE_JWT_SECRET</code> on the API, the browser sends{" "}
            <code className="text-sm bg-zinc-100 px-1 rounded">X-Dev-User-Id</code> for signed-in-style requests.
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
        <form onSubmit={sendMagicLink} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              Email
            </label>
            <input
              id="email"
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
        {msg && <p className="text-sm text-zinc-600">{msg}</p>}
        <button type="button" onClick={() => nav(-1)} className="text-sm text-violet-600">
          Back
        </button>
      </div>
    </Layout>
  );
}
