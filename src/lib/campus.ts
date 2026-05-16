export type CampusOrderingInput = {
  name: string;
  active?: boolean;
  sortOrder?: number;
};

const FALLBACK_SORT_ORDER = Number.MAX_SAFE_INTEGER;

export function campusIsActive(campus: Pick<CampusOrderingInput, "active">) {
  return campus.active !== false;
}

export function compareCampusesBySortOrder<T extends CampusOrderingInput>(
  a: T,
  b: T
) {
  const aOrder = a.sortOrder ?? FALLBACK_SORT_ORDER;
  const bOrder = b.sortOrder ?? FALLBACK_SORT_ORDER;

  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function sortCampuses<T extends CampusOrderingInput>(campuses: T[]) {
  return [...campuses].sort(compareCampusesBySortOrder);
}

export function normalizeCampusName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeCampusText(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

export function validateCampusSortOrder(sortOrder?: number) {
  if (sortOrder === undefined) {
    return null;
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return "Sort order must be a whole number greater than or equal to zero.";
  }

  return null;
}
