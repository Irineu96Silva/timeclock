<template>
  <section class="page-grid page-grid--admin">
    <div class="card">
      <div class="card-header card-header--row">
        <div>
          <h2 class="card-title">Gerenciar Empresa</h2>
          <p class="card-subtitle">{{ company?.name || "Carregando..." }}</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" @click="goBack">
          Voltar
        </button>
      </div>

      <div v-if="loading" class="muted">Carregando...</div>
      <div v-else-if="error" class="alert alert-error">{{ error }}</div>
      <div v-else-if="company">
        <div class="form">
          <h3 class="card-subtitle">Informações da Empresa</h3>
          <div class="field">
            <span class="label">Nome:</span>
            <span>{{ company.name }}</span>
          </div>
          <div class="field" v-if="company.cnpj">
            <span class="label">CNPJ:</span>
            <span>{{ company.cnpj }}</span>
          </div>
          <div class="field" v-if="company.email">
            <span class="label">Email:</span>
            <span>{{ company.email }}</span>
          </div>
          <div class="field" v-if="company.phone">
            <span class="label">Telefone:</span>
            <span>{{ company.phone }}</span>
          </div>
        </div>

        <div class="form" style="margin-top: 2rem">
          <h3 class="card-subtitle">Usuários da Empresa</h3>
          <div v-if="users.length === 0" class="muted">Nenhum usuário cadastrado</div>
          <div v-else class="list">
            <div v-for="user in users" :key="user.id" class="list-item">
              <div>
                <strong>{{ user.email }}</strong>
                <p class="muted">{{ user.role }}</p>
              </div>
              <div class="list-actions">
                <span
                  :class="['badge', user.isActive ? 'badge--success' : 'badge--danger']"
                >
                  {{ user.isActive ? "Ativo" : "Inativo" }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="form" style="margin-top: 2rem">
          <h3 class="card-subtitle">Criar Admin da Empresa</h3>
          <form @submit.prevent="handleCreateAdmin">
            <label class="field">
              <span class="label">Email</span>
              <input
                v-model="adminForm.email"
                class="input"
                type="email"
                placeholder="admin@empresa.com"
                required
              />
            </label>
            <label class="field">
              <span class="label">Senha</span>
              <input
                v-model="adminForm.password"
                class="input"
                type="password"
                placeholder="Mínimo 6 caracteres"
                required
                minlength="6"
              />
            </label>
            <button
              class="btn btn-primary"
              type="submit"
              :disabled="creatingAdmin"
            >
              {{ creatingAdmin ? "Criando..." : "Criar Admin" }}
            </button>
          </form>
          <div v-if="adminError" class="alert alert-error" style="margin-top: 1rem">
            {{ adminError }}
          </div>
          <div v-if="adminSuccess" class="alert alert-success" style="margin-top: 1rem">
            {{ adminSuccess }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type Company = {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
};

type CompanyUser = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
};

const route = useRoute();
const router = useRouter();
const companyId = route.params.id as string;

const company = ref<Company | null>(null);
const users = ref<CompanyUser[]>([]);
const loading = ref(true);
const error = ref("");

const adminForm = ref({
  email: "",
  password: "",
});
const creatingAdmin = ref(false);
const adminError = ref("");
const adminSuccess = ref("");

const loadCompany = async () => {
  loading.value = true;
  error.value = "";
  try {
    company.value = await api.get<Company>(`/super-admin/companies/${companyId}`);
    await loadUsers();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const loadUsers = async () => {
  try {
    users.value = await api.get<CompanyUser[]>(`/super-admin/companies/${companyId}/users`);
  } catch (err) {
    console.error("Erro ao carregar usuários:", err);
    error.value = getErrorMessage(err);
  }
};

const handleCreateAdmin = async () => {
  creatingAdmin.value = true;
  adminError.value = "";
  adminSuccess.value = "";
  try {
    await api.post(`/super-admin/companies/${companyId}/admin`, {
      email: adminForm.value.email,
      password: adminForm.value.password,
    });
    adminSuccess.value = "Admin criado com sucesso!";
    adminForm.value.email = "";
    adminForm.value.password = "";
    await loadUsers();
  } catch (err) {
    adminError.value = getErrorMessage(err);
  } finally {
    creatingAdmin.value = false;
  }
};

const goBack = () => {
  router.push("/super-admin/companies");
};

onMounted(() => {
  loadCompany();
});
</script>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
</style>
