import type { Session } from "@supabase/supabase-js";

export type AppRole = "doctor" | "reception" | "staff";

function parseEmails(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.trim().toLowerCase();
  if (role === "doctor") {
    return "doctor";
  }

  if (role === "reception" || role === "receptionist" || role === "secretary") {
    return "reception";
  }

  return null;
}

export function resolveUserRole(session: Session | null): AppRole {
  if (!session) {
    return "staff";
  }

  const roleFromMeta =
    normalizeRole(session.user.app_metadata?.role) ?? normalizeRole(session.user.user_metadata?.role);

  if (roleFromMeta) {
    return roleFromMeta;
  }

  const email = session.user.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return "staff";
  }

  const doctorEmails = parseEmails(process.env.NEXT_PUBLIC_DOCTOR_EMAILS);
  if (doctorEmails.includes(email)) {
    return "doctor";
  }

  const receptionEmails = parseEmails(process.env.NEXT_PUBLIC_RECEPTION_EMAILS);
  if (receptionEmails.includes(email)) {
    return "reception";
  }

  return "staff";
}

export function canAccessDoctor(session: Session | null): boolean {
  return resolveUserRole(session) !== "reception";
}
