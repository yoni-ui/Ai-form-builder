import { getSupabase } from "./supabase";
import type { FormDefinition, FormRecord } from "@/types/form";

const base = () => import.meta.env.VITE_API_URL ?? "";

const devUserId = () =>
  import.meta.env.VITE_DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";

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

export async function generateForm(prompt: string, provider: "groq" | "gemini" = "groq") {
  const res = await fetch(`${base()}/api/forms/generate`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ prompt, provider }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ definition: FormDefinition }>;
}

export async function fromDocument(file: File, hint: string, provider: "groq" | "gemini") {
  const fd = new FormData();
  fd.append("file", file);
  const headers = await authHeaders(false);
  const q = new URLSearchParams({ hint, provider });
  const res = await fetch(`${base()}/api/forms/from-document?${q}`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ definition: FormDefinition; extracted_preview?: string }>;
}

export async function listForms(): Promise<{ forms: FormRecord[] }> {
  const res = await fetch(`${base()}/api/forms`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<FormRecord>;
}

export async function listResponses(formId: string) {
  const res = await fetch(`${base()}/api/forms/${formId}/responses`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ responses: { id: string; answers: Record<string, unknown>; created_at: string }[] }>;
}

export async function getPublicForm(slug: string) {
  const res = await fetch(`${base()}/api/public/forms/${slug}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ title: string; slug: string; definition: FormDefinition }>;
}

export async function submitPublic(slug: string, answers: Record<string, unknown>) {
  const res = await fetch(`${base()}/api/public/forms/${slug}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean }>;
}
