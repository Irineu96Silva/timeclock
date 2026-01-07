<template>
  <div class="app-shell">
    <header v-if="!isKioskRoute" class="app-header">
      <div class="app-brand">
        <p class="kicker">{{ t("app.kicker") }}</p>
        <h1 class="title">{{ headerTitle }}</h1>
      </div>
      <button v-if="hasToken" class="btn btn-ghost btn-sm" type="button" @click="handleLogout">
        {{ t("app.logout") }}
      </button>
    </header>
    <main :class="['app-main', isKioskRoute ? 'app-main--kiosk' : '']">
      <nav v-if="isSuperAdminRoute" class="admin-nav">
        <router-link class="admin-nav__link" to="/super-admin/companies">
          Empresas
        </router-link>
      </nav>
      <nav v-else-if="isAdminRoute" class="admin-nav">
        <router-link class="admin-nav__link" to="/admin/dashboard">
          {{ t("admin.menu.dashboard") }}
        </router-link>
        <router-link class="admin-nav__link" to="/admin/employees">
          {{ t("admin.menu.employees") }}
        </router-link>
        <router-link class="admin-nav__link" to="/admin/settings">
          {{ t("admin.menu.settings") }}
        </router-link>
        <router-link class="admin-nav__link" to="/admin/exports">
          {{ t("admin.menu.exports") }}
        </router-link>
      </nav>
      <router-view />
    </main>
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
