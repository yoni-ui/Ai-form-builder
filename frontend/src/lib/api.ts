import { getSupabase } from "./supabase";
import type { FormDefinition, FormRecord } from "@/types/form";

const base = () => {
  const u = import.meta.env.VITE_API_URL ?? "";
  if (import.meta.env.PROD && !u.trim()) {
    console.warn(
      "[useformly] VITE_API_URL is not set. Set it in Vercel → Settings → Environment Variables to your deployed API (e.g. https://your-api.onrender.com). Otherwise /api requests hit this static host and return 404.",
    );
  }
  return u;
};

const devUserId = () =>
  import.meta.env.VITE_DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  let body: { detail?: unknown };
  try {
    body = JSON.parse(text) as { detail?: unknown };
  } catch {
    throw new Error((text || res.statusText).slice(0, 800));
  }
  const d = body.detail;
  if (typeof d === "string") throw new Error(d);
  if (Array.isArray(d))
    throw new Error(
      d.map((x: { msg?: string }) => ("msg" in (x as object) ? String((x as { msg: string }).msg) : JSON.stringify(x))).join("; "),
    );
  throw new Error((text || res.statusText).slice(0, 800));
}

async function authHeaders(json = true): Promise<HeadersInit> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const t = data.session?.access_token;
    if (t) h["Authorization"] = `Bearer ${t}`;
  }
  if (!h["Authorization"]) {
    h["X-Dev-User-Id"] = devUserId();
  }
  return h;
}

/** Prompt and/or PDF/DOCX in one request; backend picks Groq if configured, else Gemini. */
export async function createFormUnified(prompt: string, file: File | null) {
  const fd = new FormData();
  fd.append("prompt", prompt);
  if (file) fd.append("file", file);
  const res = await fetch(`${base()}/api/forms/create`, {
    method: "POST",
    headers: await authHeaders(false),
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ definition: FormDefinition }>;
}

export async function generateForm(prompt: string, provider?: "groq" | "gemini" | null) {
  const res = await fetch(`${base()}/api/forms/generate`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ prompt, provider: provider ?? null }),
  });
  await throwIfNotOk(res);
  return res.json() as Promise<{ definition: FormDefinition }>;
}

export async function fromDocument(file: File, hint: string, provider?: "groq" | "gemini" | null) {
  const fd = new FormData();
  fd.append("file", file);
  const headers = await authHeaders(false);
  const q = new URLSearchParams({ hint });
  if (provider) q.set("provider", provider);
  const res = await fetch(`${base()}/api/forms/from-document?${q}`, {
    method: "POST",
    headers,
    body: fd,
  });
  await throwIfNotOk(res);
  return res.json() as Promise<{ definition: FormDefinition; extracted_preview?: string }>;
}

export async function fetchMeUsage() {
  const res = await fetch(`${base()}/api/me/usage`, { headers: await authHeaders() });
  await throwIfNotOk(res);
  return res.json() as Promise<{
    tracked: boolean;
    daily_limit: number;
    used_today: number;
    remaining: number | null;
    unlimited?: boolean;
    note?: string;
  }>;
}

export async function fetchDashboard() {
  const res = await fetch(`${base()}/api/dashboard`, { headers: await authHeaders() });
  await throwIfNotOk(res);
  return res.json() as Promise<{
    usage: Awaited<ReturnType<typeof fetchMeUsage>>;
    forms: FormRecord[];
  }>;
}

export async function listForms(): Promise<{ forms: FormRecord[] }> {
  const res = await fetch(`${base()}/api/forms`, { headers: await authHeaders() });
  await throwIfNotOk(res);
  return res.json();
}

export async function createForm(title: string, definition: FormDefinition, published = false) {
  const res = await fetch(`${base()}/api/forms`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ title, definition, published }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<FormRecord>;
}

export async function getForm(id: string) {
  const res = await fetch(`${base()}/api/forms/${id}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<FormRecord>;
}

export async function patchForm(
  id: string,
  patch: Partial<{ title: string; definition: FormDefinition; published: boolean; slug: string }>,
) {
  const res = await fetch(`${base()}/api/forms/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  await throwIfNotOk(res);
  return res.json() as Promise<FormRecord>;
}

export async function listResponses(formId: string) {
  const res = await fetch(`${base()}/api/forms/${formId}/responses`, {
    headers: await authHeaders(),
  });
  await throwIfNotOk(res);
  return res.json() as Promise<{ responses: { id: string; answers: Record<string, unknown>; created_at: string }[] }>;
}

export async function getPublicForm(slug: string) {
  const res = await fetch(`${base()}/api/public/forms/${slug}`);
  await throwIfNotOk(res);
  return res.json() as Promise<{ title: string; slug: string; definition: FormDefinition }>;
}

export async function submitPublic(slug: string, answers: Record<string, unknown>) {
  const res = await fetch(`${base()}/api/public/forms/${slug}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  await throwIfNotOk(res);
  return res.json() as Promise<{ ok: boolean }>;
}
