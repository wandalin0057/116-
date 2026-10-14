import type { UserRole } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const isAdmin = (u: Pick<AuthUser, "role"> | null | undefined) => u?.role === "ADMIN";
