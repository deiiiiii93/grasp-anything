import { BriefDocSchema, type BriefDoc } from "./schema";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  data?: BriefDoc;
}

export function validateBrief(data: unknown): ValidationResult {
  const result = BriefDocSchema.safeParse(data);
  if (result.success) {
    return { ok: true, errors: [], data: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}
