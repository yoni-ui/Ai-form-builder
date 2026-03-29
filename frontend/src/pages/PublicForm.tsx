import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FormFillFields, type FillAnswers } from "@/components/FormFillFields";
import { Wordmark } from "@/components/Wordmark";
import { getPublicForm, submitPublic } from "@/lib/api";
import type { FormDefinition } from "@/types/form";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState("");
  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [answers, setAnswers] = useState<FillAnswers>({});
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getPublicForm(slug)
      .then((r) => {
        setTitle(r.title);
        setDefinition(r.definition);
        document.title = `${r.title} · useformly.ai`;
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      document.title = "useformly.ai";
    };
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setErr(null);
    try {
      await submitPublic(slug, answers);
      setDone(true);
      document.title = "Thank you · useformly.ai";
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    }
  }

  function onAnswerChange(id: string, value: string | boolean) {
    setAnswers((a) => ({ ...a, [id]: value }));
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
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-md shadow-zinc-200/50">
          <h1 className="text-2xl font-semibold text-zinc-900 mb-2">{title}</h1>
          <p className="text-sm text-zinc-500 mb-6">Fill in the fields below and submit.</p>
          <form onSubmit={onSubmit} className="space-y-5">
            <FormFillFields
              definition={definition}
              answers={answers}
              onChange={onAnswerChange}
              readOnly={false}
            />
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
