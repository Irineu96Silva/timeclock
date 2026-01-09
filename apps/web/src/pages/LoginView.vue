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
          <span class="label">Email ou Usuário</span>
          <input
            v-model="emailOrUsername"
            class="input"
            type="text"
            autocomplete="username"
            placeholder="Digite seu email ou nome de usuário"
            required
            @input="handleEmailInput"
            @blur="handleEmailBlur"
          />
        </label>

        <label class="field">
          <span class="label">Empresa</span>
          <select
            v-model="selectedCompanyId"
            class="input"
            :required="availableCompanies.length > 0"
            :disabled="loadingCompanies || availableCompanies.length === 0"
          >
            <option value="">{{ availableCompanies.length === 0 ? "Digite o email primeiro" : "Selecione a empresa" }}</option>
            <option v-for="company in availableCompanies" :key="company.id" :value="company.id">
              {{ company.name }}
            </option>
          </select>
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

type CompanyOption = {
  id: string;
  name: string;
};

const router = useRouter();
const emailOrUsername = ref("");
const password = ref("");
const selectedCompanyId = ref("");
const availableCompanies = ref<CompanyOption[]>([]);
const loading = ref(false);
const loadingCompanies = ref(false);
const error = ref("");
const hasToken = ref(Boolean(getAccessToken()));
let emailSearchTimeout: ReturnType<typeof setTimeout> | null = null;

const searchCompaniesByEmail = async () => {
  if (!emailOrUsername.value.trim() || !emailOrUsername.value.includes("@")) {
    // Só busca se for email (contém @)
    availableCompanies.value = [];
    selectedCompanyId.value = "";
    return;
  }

  loadingCompanies.value = true;
  try {
    // Busca empresas associadas ao email
    const companies = await api.get<CompanyOption[]>(`/auth/companies-by-email?email=${encodeURIComponent(emailOrUsername.value)}`);
    if (companies && companies.length > 0) {
      availableCompanies.value = companies;
      // Se houver apenas uma empresa, seleciona automaticamente
      if (companies.length === 1) {
        selectedCompanyId.value = companies[0].id;
      } else {
        // Se houver múltiplas, deixa o usuário escolher
        selectedCompanyId.value = "";
      }
    } else {
      // Se não encontrar empresas, limpa o select (pode ser SUPER_ADMIN)
      availableCompanies.value = [];
      selectedCompanyId.value = "";
    }
  } catch (err) {
    // Se der erro, limpa (pode ser SUPER_ADMIN ou usuário não encontrado)
    availableCompanies.value = [];
    selectedCompanyId.value = "";
    console.error("Erro ao buscar empresas:", err);
  } finally {
    loadingCompanies.value = false;
  }
};

const handleEmailInput = () => {
  // Limpa timeout anterior
  if (emailSearchTimeout) {
    clearTimeout(emailSearchTimeout);
  }
  
  // Limpa empresas enquanto digita
  availableCompanies.value = [];
  selectedCompanyId.value = "";
  
  // Aguarda 500ms após parar de digitar para buscar
  emailSearchTimeout = setTimeout(() => {
    searchCompaniesByEmail();
  }, 500);
};

const handleEmailBlur = async () => {
  // Cancela timeout se ainda estiver aguardando
  if (emailSearchTimeout) {
    clearTimeout(emailSearchTimeout);
    emailSearchTimeout = null;
  }
  
  // Busca imediatamente ao sair do campo
  await searchCompaniesByEmail();
};

const handleSubmit = async () => {
  error.value = "";
  loading.value = true;
  try {
    const loginData: any = {
      password: password.value,
    };

    // Determina se é email ou username
    if (emailOrUsername.value.includes("@")) {
      loginData.email = emailOrUsername.value.toLowerCase().trim();
    } else {
      loginData.username = emailOrUsername.value.toLowerCase().trim();
    }

    // Adiciona companyId se foi selecionado
    if (selectedCompanyId.value) {
      loginData.companyId = selectedCompanyId.value;
    }

    const response = await api.post<LoginResponse>("/auth/login", loginData);
    setAccessToken(response.access_token);
    hasToken.value = true;
    let destination = "/admin/dashboard";
    try {
      const me = await api.get<MeResponse>("/auth/me");
      const role = me.role?.toUpperCase();
      if (role) {
        setUserRole(role);
      }
      if (role === "SUPER_ADMIN") {
        destination = "/super-admin/companies";
      } else if (role === "EMPLOYEE") {
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
