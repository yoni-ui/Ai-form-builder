import type { FormDefinition, FormField } from "@/types/form";

export type FillAnswers = Record<string, string | boolean>;

type Props = {
  definition: FormDefinition;
  answers: FillAnswers;
  onChange: (fieldId: string, value: string | boolean) => void;
  readOnly?: boolean;
};

/** Shared field rendering: public fill page (editable) or editor preview (read-only). */
export function FormFillFields({ definition, answers, onChange, readOnly = false }: Props) {
  const dis = readOnly;

  function setAnswer(id: string, v: string | boolean) {
    if (!dis) onChange(id, v);
  }

  return (
    <div className="space-y-5">
      {definition.sections.map((sec) => (
        <div key={sec.id} className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{sec.title}</h2>
          {sec.fields.map((f: FormField) => (
            <div key={f.id}>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.type === "textarea" && (
                <textarea
                  required={f.required && !dis}
                  disabled={dis}
                  readOnly={dis}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
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
                    disabled={dis}
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
                  required={f.required && !dis}
                  disabled={dis}
                  readOnly={dis}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
                  value={(answers[f.id] as string) ?? ""}
                  onChange={(e) => setAnswer(f.id, e.target.value)}
                  placeholder={f.placeholder ?? undefined}
                />
              )}
              {f.type === "select" && (
                <select
                  required={f.required && !dis}
                  disabled={dis}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500"
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
    </div>
  );
}
