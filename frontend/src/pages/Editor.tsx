import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FormFillFields } from "@/components/FormFillFields";
import { Layout } from "@/components/Layout";
import { createForm, getForm, patchForm } from "@/lib/api";
import type { FieldType, FormDefinition, FormField, FormSection } from "@/types/form";

const FIELD_TYPES: FieldType[] = [
  "text",
  "email",
  "number",
  "textarea",
  "select",
  "checkbox",
  "date",
];

function emptyDefinition(title: string): FormDefinition {
  return {
    version: 1,
    title,
    sections: [
      {
        id: crypto.randomUUID(),
        title: "Section 1",
        fields: [
          {
            id: crypto.randomUUID(),
            type: "text",
            label: "New field",
            required: false,
          },
        ],
      },
    ],
  };
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const loc = useLocation() as {
    state?: { definition?: FormDefinition; title?: string };
  };
  const nav = useNavigate();

  const [title, setTitle] = useState(
    loc.state?.title ?? loc.state?.definition?.title ?? "Untitled form",
  );
  const [definition, setDefinition] = useState<FormDefinition | null>(
    loc.state?.definition ?? null,
  );
  const [formId, setFormId] = useState<string | null>(id ?? null);
  const [slug, setSlug] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      const row = await getForm(id);
      setTitle(row.title);
      setDefinition(row.definition);
      setSlug(row.slug);
      setPublished(row.published);
      setFormId(row.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  useEffect(() => {
    if (!id && !definition) {
      setDefinition(loc.state?.definition ?? emptyDefinition(title));
      if (loc.state?.title) setTitle(loc.state.title);
      else if (loc.state?.definition?.title) setTitle(loc.state.definition.title);
    }
  }, [id, definition, loc.state, title]);

  function updateDefinition(fn: (d: FormDefinition) => FormDefinition) {
    setDefinition((d) => (d ? fn(d) : d));
  }

  function addSection() {
    updateDefinition((d) => ({
      ...d,
      sections: [
        ...d.sections,
        {
          id: crypto.randomUUID(),
          title: `Section ${d.sections.length + 1}`,
          fields: [
            {
              id: crypto.randomUUID(),
              type: "text",
              label: "New field",
              required: false,
            },
          ],
        },
      ],
    }));
  }

  function addField(sectionId: string) {
    updateDefinition((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: [
                ...s.fields,
                {
                  id: crypto.randomUUID(),
                  type: "text",
                  label: "New field",
                  required: false,
                },
              ],
            }
          : s,
      ),
    }));
  }

  function moveField(sectionId: string, index: number, dir: -1 | 1) {
    updateDefinition((d) => ({
      ...d,
      sections: d.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const fields = [...s.fields];
        const j = index + dir;
        if (j < 0 || j >= fields.length) return s;
        [fields[index], fields[j]] = [fields[j], fields[index]];
        return { ...s, fields };
      }),
    }));
  }

  function updateField(sectionId: string, fieldId: string, patch: Partial<FormField>) {
    updateDefinition((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
            }
          : s,
      ),
    }));
  }

  function removeField(sectionId: string, fieldId: string) {
    updateDefinition((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s,
      ),
    }));
  }

  function updateSectionTitle(sectionId: string, t: string) {
    updateDefinition((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === sectionId ? { ...s, title: t } : s)),
    }));
  }

  async function save() {
    if (!definition) return;
    setBusy(true);
    setErr(null);
    try {
      const def = { ...definition, title };
      if (formId) {
        const row = await patchForm(formId, { title, definition: def });
        setSlug(row.slug);
        setPublished(row.published);
      } else {
        const row = await createForm(title, def, published);
        setFormId(row.id);
        setSlug(row.slug);
        nav(`/editor/${row.id}`, { replace: true, state: {} });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!definition) return;
    setBusy(true);
    setErr(null);
    try {
      const def = { ...definition, title };
      let fid = formId;
      if (!fid) {
        const created = await createForm(title, def, false);
        fid = created.id;
        setFormId(created.id);
        setSlug(created.slug);
        nav(`/editor/${created.id}`, { replace: true, state: {} });
      }
      const row = await patchForm(fid!, { title, definition: def, published: true });
      setPublished(row.published);
      setSlug(row.slug);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!definition) {
    return (
      <Layout>
        <p className="text-zinc-600">{busy ? "Loading…" : err ?? "No form."}</p>
        <Link to="/" className="text-violet-600">
          Home
        </Link>
      </Layout>
    );
  }

  const shareUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/f/${slug}`
      : "";

  const noopAnswer = () => {};

  return (
    <Layout>
      <div className="lg:grid lg:grid-cols-[1fr_min(36vw,400px)] xl:grid-cols-[1fr_420px] gap-8 lg:items-start">
        <div className="space-y-8 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-zinc-700">Form title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full max-w-xl rounded-lg border border-zinc-300 px-3 py-2 font-medium"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={busy}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Publish
            </button>
            <Link to="/forms" className="rounded-lg px-4 py-2 text-sm font-medium text-violet-600">
              My forms
            </Link>
            <Link to="/dashboard" className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700">
              Dashboard
            </Link>
            {formId && (
              <Link
                to={`/editor/${formId}/responses`}
                className="rounded-lg px-4 py-2 text-sm font-medium text-violet-600"
              >
                Responses
              </Link>
            )}
          </div>
        </div>

        {published && shareUrl && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex flex-wrap items-center gap-3">
            <span>
              <span className="font-medium">Public link: </span>
              <a href={shareUrl} className="underline break-all">
                {shareUrl}
              </a>
            </span>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-white text-xs font-semibold hover:bg-emerald-800"
            >
              Open public page
            </a>
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="space-y-8">
          {definition.sections.map((section: FormSection) => (
            <section key={section.id} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <input
                value={section.title}
                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                className="mb-4 w-full border-b border-transparent text-lg font-semibold outline-none focus:border-violet-300"
              />
              <ul className="space-y-4">
                {section.fields.map((field, idx) => (
                  <li
                    key={field.id}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 sm:flex-row sm:flex-wrap sm:items-center"
                  >
                    <input
                      value={field.label}
                      onChange={(e) => updateField(section.id, field.id, { label: e.target.value })}
                      className="flex-1 min-w-[140px] rounded border border-zinc-200 px-2 py-1 text-sm font-medium"
                      placeholder="Label"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const t = e.target.value as FieldType;
                        const patch: Partial<FormField> = { type: t };
                        if (t === "select") patch.options = field.options?.length ? field.options : ["Option A", "Option B"];
                        if (t !== "select") patch.options = undefined;
                        updateField(section.id, field.id, patch);
                      }}
                      className="rounded border border-zinc-200 px-2 py-1 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-zinc-600">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          updateField(section.id, field.id, { required: e.target.checked })
                        }
                      />
                      Required
                    </label>
                    {field.type === "select" && (
                      <input
                        value={(field.options ?? []).join(", ")}
                        onChange={(e) =>
                          updateField(section.id, field.id, {
                            options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="min-w-[200px] flex-1 rounded border border-zinc-200 px-2 py-1 text-sm"
                        placeholder="Options, comma-separated"
                      />
                    )}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-zinc-200 px-2 py-1 text-xs"
                        onClick={() => moveField(section.id, idx, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded border border-zinc-200 px-2 py-1 text-xs"
                        onClick={() => moveField(section.id, idx, 1)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                        onClick={() => removeField(section.id, field.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => addField(section.id)}
                className="mt-4 text-sm font-medium text-violet-600"
              >
                + Add field
              </button>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={addSection}
          className="text-sm font-semibold text-violet-600"
        >
          + Add section
        </button>
        </div>

        <aside className="hidden lg:block sticky top-24 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <h3 className="text-sm font-semibold text-zinc-900">Public page preview</h3>
          <p className="text-xs text-zinc-500 mt-1 mb-4">Read-only — same layout as /f/… for respondents.</p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="font-medium text-zinc-900 mb-1">{title}</p>
            <p className="text-xs text-zinc-500 mb-4">Fill in the fields below and submit.</p>
            <FormFillFields
              definition={definition}
              answers={{}}
              onChange={noopAnswer}
              readOnly
            />
            <div className="mt-4 rounded-lg bg-zinc-100 py-2.5 text-center text-xs font-medium text-zinc-400">
              Submit (preview)
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
