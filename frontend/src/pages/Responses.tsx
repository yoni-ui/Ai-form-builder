import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { getForm, listResponses } from "@/lib/api";

export default function Responses() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<{ id: string; answers: Record<string, unknown>; created_at: string }[]>(
    [],
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getForm(id), listResponses(id)])
      .then(([form, res]) => {
        setTitle(form.title);
        setRows(res.responses);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [id]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to={`/editor/${id}`} className="text-sm text-violet-600">
            ← Editor
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900">Responses · {title}</h1>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-700">When</th>
                <th className="px-4 py-3 font-medium text-zinc-700">Answers (JSON)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-zinc-500">
                    No responses yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-800 break-all">
                    {JSON.stringify(r.answers)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
