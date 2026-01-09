import { createRouter, createWebHistory } from "vue-router";
import { getAccessToken, getUserRole } from "./services/api";

const routes = [
  {
    path: "/login",
    component: () => import("./pages/LoginView.vue"),
  },
  {
    path: "/admin/employees",
    component: () => import("./pages/AdminEmployeesView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin/dashboard",
    component: () => import("./pages/DashboardRHView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin/settings",
    component: () => import("./pages/AdminSettingsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/admin/exports",
    component: () => import("./pages/AdminExportsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/super-admin/companies",
    component: () => import("./pages/SuperAdminCompaniesView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/super-admin/companies/:id",
    component: () => import("./pages/SuperAdminCompanyManageView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/employee/home",
    component: () => import("./pages/EmployeeHomeView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/employee/history",
    component: () => import("./pages/EmployeeHistoryView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/kiosk/qr",
    component: () => import("./pages/KioskQrView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/kiosk",
    component: () => import("./pages/KioskView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/login",
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const token = getAccessToken();
  if (to.meta.requiresAuth && !token) {
    return "/login";
  }
  if (to.path === "/login" && token) {
    const role = getUserRole()?.toUpperCase();
    if (role === "SUPER_ADMIN") {
      return "/super-admin/companies";
    }
    if (role === "EMPLOYEE") {
      return "/employee/home";
    }
    if (role === "KIOSK") {
      return "/kiosk";
    }
    return "/admin/dashboard";
  }
  const role = getUserRole()?.toUpperCase();
  if (role === "SUPER_ADMIN") {
    if (!to.path.startsWith("/super-admin")) {
      return "/super-admin/companies";
    }
  } else if (role === "KIOSK") {
    if (!to.path.startsWith("/kiosk")) {
      return "/kiosk";
    }
  } else if (role === "EMPLOYEE") {
    if (to.path.startsWith("/admin") || to.path.startsWith("/kiosk") || to.path.startsWith("/super-admin")) {
      return "/employee/home";
    }
  } else if (role === "ADMIN") {
    if (to.path.startsWith("/employee") || to.path.startsWith("/kiosk") || to.path.startsWith("/super-admin")) {
      return "/admin/dashboard";
    }
  }
  return true;
});
