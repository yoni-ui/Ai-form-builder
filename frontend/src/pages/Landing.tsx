import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { createFormUnified, fetchMeUsage } from "@/lib/api";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function Landing() {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [usageLine, setUsageLine] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!supabaseConfigured || !sessionEmail) {
      setUsageLine(null);
      return;
    }
    fetchMeUsage()
      .then((u) => {
        if (u.unlimited) setUsageLine(null);
        else if (!u.tracked)
          setUsageLine(`Limits apply with Supabase JWT on the API (${u.daily_limit}/day UTC).`);
        else setUsageLine(`AI generations today: ${u.used_today}/${u.daily_limit} (${u.remaining} left, UTC).`);
      })
      .catch(() => setUsageLine(null));
  }, [sessionEmail]);

  const canSubmit = Boolean(prompt.trim() || file);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    if (import.meta.env.PROD) {
      if (!supabaseConfigured) {
        setErr(
          "Production needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Vercel (same Supabase project as the API) so you can sign in and send a Bearer token.",
        );
        return;
      }
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          setErr("Sign in to generate forms — the deployed API requires a Supabase session (Authorization bearer token).");
          return;
        }
      }
    }
    setBusy(true);
    try {
      const { definition } = await createFormUnified(prompt, file);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      nav("/editor", { state: { definition, title: definition.title } });
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const ok =
      f.type === "application/pdf" ||
      f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      f.name.toLowerCase().endsWith(".pdf") ||
      f.name.toLowerCase().endsWith(".docx");
    if (!ok) {
      setErr("Please drop a PDF or DOCX file.");
      return;
    }
    setErr(null);
    setFile(f);
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
            Type what you need, drop a PDF or DOCX, or both — one place. We pick the best available model
            automatically (Groq first, then Gemini).
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
              <Link to="/dashboard" className="font-medium text-zinc-700 hover:text-zinc-900">
                Dashboard
              </Link>
              <Link to="/forms" className="font-medium text-zinc-700 hover:text-zinc-900">
                My forms
              </Link>
            </>
          )}
          {!supabaseConfigured && (
            <span className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              Dev: Supabase not configured in the browser — use SQLite + dev headers on the API, or add VITE_SUPABASE_* for real auth.
            </span>
          )}
        </div>

        {usageLine && (
          <p className="text-sm text-zinc-600 max-w-2xl rounded-lg border border-violet-100 bg-violet-50/80 px-4 py-2">
            {usageLine}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Describe your form or attach a document
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed transition-colors ${
              drag ? "border-violet-500 bg-violet-50/50" : "border-zinc-300 bg-white"
            }`}
          >
            <textarea
              id="prompt"
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Job application for software engineers with experience and portfolio links…&#10;&#10;Or drop a PDF/DOCX anywhere in this box."
              className="w-full rounded-t-2xl border-0 px-4 py-3 text-zinc-900 shadow-none focus:ring-0 outline-none resize-y min-h-[160px] bg-transparent"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 px-4 py-3 rounded-b-2xl bg-zinc-50/80">
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                {file ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-3 py-1.5">
                    <span className="font-medium text-zinc-800 truncate max-w-[200px]">{file.name}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  </span>
                ) : (
                  <span>Drop a file here or choose one</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setErr(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Attach PDF / DOCX
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Model: <span className="font-medium text-zinc-700">automatic</span> — Groq when{" "}
            <code className="text-zinc-600">GROQ_API_KEY</code> is set, otherwise Gemini.
          </p>
          <button
            type="submit"
            disabled={busy || !canSubmit}
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
