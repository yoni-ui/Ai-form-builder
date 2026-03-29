import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Wordmark } from "@/components/Wordmark";
import { getPublicForm, submitPublic } from "@/lib/api";
import type { FormDefinition, FormField } from "@/types/form";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState("");
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getPublicForm(slug)
      .then((r) => {
        setTitle(r.title);
        setDefinition(r.definition);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setErr(null);
    try {
      await submitPublic(slug, answers);
      setDone(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    }
  }

  function setAnswer(id: string, v: string | boolean) {
    setAnswers((a) => ({ ...a, [id]: v }));
  }

  if (err && !definition) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-50">
        <Wordmark className="mb-6" />
        <p className="text-red-600 text-center">{err}</p>
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-50">
        <Wordmark className="mb-6" />
        <h1 className="text-2xl font-semibold text-zinc-900">Thank you</h1>
        <p className="text-zinc-600 mt-2">Your response was submitted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900 mb-6">{title}</h1>
          <form onSubmit={onSubmit} className="space-y-5">
            {definition.sections.map((sec) => (
              <div key={sec.id} className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  {sec.title}
                </h2>
                {sec.fields.map((f: FormField) => (
                  <div key={f.id}>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                    </label>
                    {f.type === "textarea" && (
                      <textarea
                        required={f.required}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                        rows={3}
                        value={(answers[f.id] as string) ?? ""}
                        onChange={(e) => setAnswer(f.id, e.target.value)}
                        placeholder={f.placeholder ?? undefined}
                      />
                    )}
                    {f.type === "checkbox" && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(answers[f.id])}
                          onChange={(e) => setAnswer(f.id, e.target.checked)}
                        />
                        <span className="text-sm text-zinc-600">Yes</span>
                      </label>
                    )}
                    {(f.type === "text" ||
                      f.type === "email" ||
                      f.type === "number" ||
                      f.type === "date") && (
                      <input
                        type={
                          f.type === "email"
                            ? "email"
                            : f.type === "number"
                              ? "number"
                              : f.type === "date"
                                ? "date"
                                : "text"
                        }
                        required={f.required}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                        value={(answers[f.id] as string) ?? ""}
                        onChange={(e) => setAnswer(f.id, e.target.value)}
                        placeholder={f.placeholder ?? undefined}
                      />
                    )}
                    {f.type === "select" && (
                      <select
                        required={f.required}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                        value={(answers[f.id] as string) ?? ""}
                        onChange={(e) => setAnswer(f.id, e.target.value)}
                      >
                        <option value="">Choose…</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
            >
              Submit
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-zinc-400 mt-8">Powered by useformly.ai</p>
      </div>
    </div>
  );
}
