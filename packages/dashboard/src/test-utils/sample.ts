import sampleJson from "@grasp/schema/sample-brief.json";
import { validateBrief, type BriefDoc } from "@grasp/schema";

const result = validateBrief(sampleJson);
if (!result.ok || !result.data) {
  throw new Error(`golden sample is invalid: ${result.errors.join(", ")}`);
}

export const sampleDoc: BriefDoc = result.data;
