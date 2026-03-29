import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { fetchDashboard } from "@/lib/api";
import type { FormRecord } from "@/types/form";

type Usage = {
  tracked: boolean;
  daily_limit: number;
  used_today: number;
  remaining: number | null;
  unlimited?: boolean;
  note?: string;
};

export default function Dashboard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [forms, setForms] = useState<(FormRecord & { response_count?: number })[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then((d) => {
        setUsage(d.usage);
        setForms(d.forms);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              New form
            </Link>
            <Link to="/forms" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium">
              All forms
            </Link>
          </div>
        </div>

        {usage && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">AI generations today (UTC)</h2>
            {usage.unlimited ? (
              <p className="text-zinc-700">No daily limit configured.</p>
            ) : !usage.tracked ? (
              <p className="text-zinc-700">
                {usage.note ?? "Sign in with Supabase to track daily limits."} Limit would be{" "}
                <span className="font-semibold">{usage.daily_limit}</span>/day.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">
                    Used {usage.used_today} of {usage.daily_limit}
                  </span>
                  <span className="font-medium text-zinc-900">{usage.remaining} left</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-violet-600 transition-all"
                    style={{
                      width: `${Math.min(100, (usage.used_today / Math.max(1, usage.daily_limit)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200">
            <h2 className="font-semibold text-zinc-900">Forms & responses</h2>
            <p className="text-sm text-zinc-500 mt-1">Quick links to edit, public page, and response list.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  <th className="px-4 py-3 font-medium text-zinc-700">Form</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">Responses</th>
                  <th className="px-4 py-3 font-medium text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 && !err && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-zinc-500">
                      No forms yet.{" "}
                      <Link to="/" className="text-violet-600 font-medium">
                        Create one
                      </Link>
                    </td>
                  </tr>
                )}
                {forms.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-100">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{f.title}</span>
                      <p className="text-xs text-zinc-500">
                        {f.published ? (
                          <>
                            Live:{" "}
                            <a href={`/f/${f.slug}`} className="text-violet-600 underline">
                              /f/{f.slug}
                            </a>
                          </>
                        ) : (
                          "Draft"
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 tabular-nums">{f.response_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/editor/${f.id}`} className="text-violet-600 hover:underline">
                          Edit
                        </Link>
                        <Link to={`/editor/${f.id}/responses`} className="text-violet-600 hover:underline">
                          Responses
                        </Link>
                        {f.published && (
                          <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer" className="text-zinc-600 hover:underline">
                            Open public
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
