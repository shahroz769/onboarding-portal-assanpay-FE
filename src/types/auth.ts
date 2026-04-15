export const roleTypes = ["admin", "supervisor", "employee"] as const;

export type RoleType = (typeof roleTypes)[number];

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  roleType: RoleType;
  status: "active" | "inactive";
  accessPolicyId: string | null;
  createdByUserId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  accessToken: string;
  user: User;
};

export type RefreshResponse = {
  accessToken: string;
  user: User;
};
