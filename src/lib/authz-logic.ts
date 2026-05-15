import type { Role } from "./domain";

export function canAccessStaff(role: Role) {
  return role === "Developer" || role === "Admin" || role === "Staff";
}

export function canAccessAdmin(role: Role) {
  return role === "Developer" || role === "Admin";
}
