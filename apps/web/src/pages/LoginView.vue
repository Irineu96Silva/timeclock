<template>
  <section class="page-grid page-grid--single">
    <div class="card">
      <div class="card-header card-header--row">
        <div>
          <h2 class="card-title">{{ t("login.title") }}</h2>
          <p class="card-subtitle">{{ t("login.subtitle") }}</p>
        </div>
        <button v-if="hasToken" class="btn btn-ghost btn-sm" type="button" @click="handleLogout">
          {{ t("app.logout") }}
        </button>
      </div>

      <form class="form" @submit.prevent="handleSubmit">
        <label class="field">
          <span class="label">{{ t("login.emailLabel") }}</span>
          <input
            v-model="email"
            class="input"
            type="email"
            autocomplete="email"
            :placeholder="t('login.emailPlaceholder')"
            required
          />
        </label>

        <label class="field">
          <span class="label">{{ t("login.passwordLabel") }}</span>
          <input
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            :placeholder="t('login.passwordPlaceholder')"
            required
          />
        </label>

        <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
          {{ loading ? t("login.submitting") : t("login.submit") }}
        </button>
      </form>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { t } from "../i18n";
import { api, clearAccessToken, getAccessToken, setAccessToken, setUserRole } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
};
type MeResponse = {
  role: string;
};

const router = useRouter();
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");
const hasToken = ref(Boolean(getAccessToken()));

const handleSubmit = async () => {
  error.value = "";
  loading.value = true;
  try {
    const response = await api.post<LoginResponse>("/auth/login", {
      email: email.value,
      password: password.value,
    });
    setAccessToken(response.access_token);
    hasToken.value = true;
    let destination = "/admin/dashboard";
    try {
      const me = await api.get<MeResponse>("/auth/me");
      const role = me.role?.toUpperCase();
      if (role) {
        setUserRole(role);
      }
      if (role === "EMPLOYEE") {
        destination = "/employee/home";
      } else if (role === "KIOSK") {
        destination = "/kiosk";
      }
    } catch {
      // fallback to admin route
    }
    router.push(destination);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const handleLogout = async () => {
  try {
    await api.post("/auth/logout");
  } catch {
    // ignore errors on logout
  } finally {
    clearAccessToken();
    hasToken.value = false;
  }
};
</script>
