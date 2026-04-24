const STORAGE_KEY = "pytorch-mastery-progress";

export type ProgressMap = Record<string, boolean>;

export function getProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setProblemCompleted(problemId: string): void {
  if (typeof window === "undefined") return;
  const progress = getProgress();
  progress[problemId] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function isProblemCompleted(problemId: string): boolean {
  return !!getProgress()[problemId];
}

export function arePrerequisitesMet(
  prerequisites: string[],
  progress?: ProgressMap
): boolean {
  if (prerequisites.length === 0) return true;
  const p = progress ?? getProgress();
  return prerequisites.every((id) => !!p[id]);
}

export function clearProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
