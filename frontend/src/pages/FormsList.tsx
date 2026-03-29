import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { listForms } from "@/lib/api";
import type { FormRecord } from "@/types/form";

export default function FormsList() {
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listForms()
      .then((r) => setForms(r.forms))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">My forms</h1>
          <Link
            to="/"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            New form
          </Link>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {forms.length === 0 && !err && (
            <li className="px-6 py-12 text-center text-zinc-500">No forms yet.</li>
          )}
          {forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <Link
                  to={`/editor/${f.id}`}
                  className="font-medium text-zinc-900 hover:text-violet-600"
                >
                  {f.title}
                </Link>
                <p className="text-xs text-zinc-500">
                  {f.published ? (
                    <>
                      Published ·{" "}
                      <Link to={`/f/${f.slug}`} className="text-violet-600">
                        /f/{f.slug}
                      </Link>
                    </>
                  ) : (
                    "Draft"
                  )}
                </p>
              </div>
              <Link
                to={`/editor/${f.id}/responses`}
                className="text-sm text-violet-600 hover:underline"
              >
                Responses
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
