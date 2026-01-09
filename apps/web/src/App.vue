<template>
  <div class="app-shell">
    <header 
      v-if="!isKioskRoute" 
      :class="['app-header', isEmployeeRoute ? 'app-header--employee-mobile' : '']"
    >
      <div class="app-brand">
        <p class="kicker">{{ t("app.kicker") }}</p>
        <h1 class="title">{{ headerTitle }}</h1>
      </div>
      <button v-if="hasToken" class="btn btn-ghost btn-sm" type="button" @click="handleLogout">
        {{ t("app.logout") }}
      </button>
    </header>
    <div class="app-layout">
      <aside v-if="!isKioskRoute && (isSuperAdminRoute || isAdminRoute)" class="app-sidebar">
        <nav class="sidebar-nav">
          <template v-if="isSuperAdminRoute">
            <router-link class="sidebar-nav__link" to="/super-admin/companies">
              <span class="sidebar-nav__icon">🏢</span>
              <span>Empresas</span>
            </router-link>
          </template>
          <template v-else-if="isAdminRoute">
            <router-link class="sidebar-nav__link" to="/admin/dashboard">
              <span class="sidebar-nav__icon">📊</span>
              <span>{{ t("admin.menu.dashboard") }}</span>
            </router-link>
            <router-link class="sidebar-nav__link" to="/admin/employees">
              <span class="sidebar-nav__icon">👥</span>
              <span>{{ t("admin.menu.employees") }}</span>
            </router-link>
            <router-link class="sidebar-nav__link" to="/admin/settings">
              <span class="sidebar-nav__icon">⚙️</span>
              <span>{{ t("admin.menu.settings") }}</span>
            </router-link>
            <router-link class="sidebar-nav__link" to="/admin/exports">
              <span class="sidebar-nav__icon">📥</span>
              <span>{{ t("admin.menu.exports") }}</span>
            </router-link>
          </template>
        </nav>
      </aside>
      <main :class="['app-main', isKioskRoute ? 'app-main--kiosk' : '', (isSuperAdminRoute || isAdminRoute) ? 'app-main--with-sidebar' : '']">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { t } from "./i18n";
import { api, clearAccessToken, getAccessToken, getUserRole } from "./services/api";

const router = useRouter();
const route = useRoute();

const hasToken = computed(() => {
  void route.path;
  return Boolean(getAccessToken());
});

const userRole = computed(() => getUserRole()?.toUpperCase());
const isSuperAdminRoute = computed(() => route.path.startsWith("/super-admin"));
const isAdminRoute = computed(() => route.path.startsWith("/admin"));
const isKioskRoute = computed(() => route.path.startsWith("/kiosk"));
const isEmployeeRoute = computed(() => route.path.startsWith("/employee"));

const headerTitle = computed(() => {
  const path = route.path;
  if (path.startsWith("/super-admin")) {
    return "Super Admin";
  }
  if (path.startsWith("/employee")) {
    return t("app.header.employee");
  }
  if (path.startsWith("/kiosk")) {
    return t("app.header.kiosk");
  }
  if (path.startsWith("/admin")) {
    return t("app.header.admin");
  }
  return t("app.header.default");
});

const handleLogout = async () => {
  try {
    await api.post("/auth/logout");
  } catch {
    // ignore errors on logout
  } finally {
    clearAccessToken();
    router.push("/login");
  }
};
</script>
