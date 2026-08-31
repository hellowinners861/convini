import { ContentValidationError } from "./validation";

export interface PrioritizedIdentified {
  id: string;
  priority: number;
}

export function comparePriorityThenId(left: PrioritizedIdentified, right: PrioritizedIdentified): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? -1 : 1;
}

export function sortByPriorityThenId<T extends PrioritizedIdentified>(items: T[]): T[] {
  return [...items].sort(comparePriorityThenId);
}

export function selectBestByPriorityThenId<T extends PrioritizedIdentified>(items: T[]): T | undefined {
  return sortByPriorityThenId(items)[0];
}

export function selectWithoutPriorityAmbiguity<T extends PrioritizedIdentified>(
  items: T[],
  label: string,
): T | undefined {
  const sorted = sortByPriorityThenId(items);
  if (sorted.length > 1 && sorted[0].priority === sorted[1].priority) {
    throw new ContentValidationError(`Ambiguous ${label}`, [
      `${sorted[0].id} and ${sorted[1].id} share priority ${sorted[0].priority}`,
    ]);
  }
  return sorted[0];
}
