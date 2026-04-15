import {
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { RoleType } from "#/types/auth";

export type NavSubItem = {
  title: string;
  url: string;
  roles?: RoleType[];
};

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  roles?: RoleType[];
  items?: NavSubItem[];
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Merchants",
    url: "/merchants",
    icon: BriefcaseBusiness,
  },
  {
    title: "Cases",
    url: "/cases",
    icon: ClipboardList,
    items: [
      {
        title: "All Cases",
        url: "/cases/all-cases",
      },
      {
        title: "My Open Cases",
        url: "/cases/my-open-cases",
      },
      {
        title: "My Closed Cases",
        url: "/cases/my-closed-cases",
      },
    ],
  },
  {
    title: "User Management",
    url: "/user-management",
    icon: Users,
    roles: ["admin", "supervisor"],
    items: [
      {
        title: "All Users",
        url: "/user-management/all-users",
      },
      {
        title: "User Creation",
        url: "/user-management/user-creation",
      },
      {
        title: "Access Policy",
        url: "/user-management/access-policy",
      },
    ],
  },
];

export function getFilteredNavItems(roleType: RoleType): NavItem[] {
  return navItems
    .filter((item) => !item.roles || item.roles.includes(roleType))
    .map((item) => {
      if (!item.items) return item;
      const filteredSubItems = item.items.filter(
        (sub) => !sub.roles || sub.roles.includes(roleType)
      );
      return { ...item, items: filteredSubItems };
    });
}
