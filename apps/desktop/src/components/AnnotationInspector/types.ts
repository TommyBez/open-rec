import type { Annotation } from "../../types/project";

export type AnnotationDraft = Annotation;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
