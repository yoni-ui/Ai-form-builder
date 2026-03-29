import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { generateForm, fromDocument } from "@/lib/api";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function Landing() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"groq" | "gemini">("groq");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { definition } = await generateForm(prompt, provider);
      nav("/editor", { state: { definition, title: definition.title } });
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | null) {
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      const { definition } = await fromDocument(f, prompt, provider);
      nav("/editor", { state: { definition, title: definition.title } });
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-violet-600">useformly.ai</p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Turn documents and ideas into smart forms.
          </h1>
          <p className="text-lg text-zinc-600">
            Describe what you need or upload a PDF/DOCX. We generate a structured form you can edit and share.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {supabaseConfigured && (
            <>
              {sessionEmail ? (
                <span className="text-zinc-600">{sessionEmail}</span>
              ) : (
                <Link to="/login" className="font-medium text-violet-600 hover:text-violet-700">
                  Sign in
                </Link>
              )}
              <Link to="/forms" className="font-medium text-zinc-700 hover:text-zinc-900">
                My forms
              </Link>
            </>
          )}
          {!supabaseConfigured && (
            <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              Dev mode: configure Supabase env vars for auth, or use API without JWT secret.
            </span>
          )}
        </div>

        <form onSubmit={onGenerate} className="space-y-4 max-w-2xl">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-zinc-700 mb-2">
              Prompt
            </label>
            <textarea
              id="prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Customer onboarding form for a fintech app with KYC fields"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none resize-y min-h-[120px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-zinc-700">
              Model:&nbsp;
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "groq" | "gemini")}
                className="ml-1 rounded-lg border border-zinc-300 px-2 py-1"
              >
                <option value="groq">Groq</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="text-sm text-zinc-700 cursor-pointer">
              <span className="mr-2">Or upload PDF / DOCX</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="text-sm"
                disabled={busy}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="rounded-xl bg-violet-600 px-6 py-3 text-white font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Generate form"}
          </button>
          {err && <p className="text-sm text-red-600 whitespace-pre-wrap">{err}</p>}
        </form>
      </div>
    </Layout>
  );
}
