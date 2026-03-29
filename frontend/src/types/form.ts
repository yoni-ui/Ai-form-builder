export type FieldType =
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "date";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[] | null;
  placeholder?: string | null;
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface FormDefinition {
  version: 1;
  title: string;
  sections: FormSection[];
}

export interface FormRecord {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  definition: FormDefinition;
  created_at?: string;
  updated_at?: string;
}
