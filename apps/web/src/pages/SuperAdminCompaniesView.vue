<template>
  <section class="page-grid page-grid--single">
    <div class="card">
      <div class="card-header card-header--row">
        <div>
          <h2 class="card-title">Gerenciar Empresas</h2>
          <p class="card-subtitle">Cadastre e gerencie todas as empresas do sistema</p>
        </div>
        <button class="btn btn-primary" type="button" @click="showCreateModal = true">
          + Nova Empresa
        </button>
      </div>

      <div v-if="loading" class="muted">Carregando empresas...</div>
      <div v-else-if="error" class="alert alert-error">
        <div><strong>Erro:</strong> {{ error }}</div>
        <div v-if="errorDetails" style="margin-top: 0.5rem; font-size: 0.875rem; opacity: 0.8;">
          {{ errorDetails }}
        </div>
      </div>
      <div v-else-if="companies.length === 0" class="muted">
        <div style="text-align: center; padding: 2rem;">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Nenhuma empresa cadastrada</p>
          <p style="color: var(--color-muted);">Clique em "Nova Empresa" para começar</p>
        </div>
      </div>
      <div v-else class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CNPJ</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Status</th>
              <th>Usuários</th>
              <th>Funcionários</th>
              <th>Registros</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="company in companies" :key="company.id">
              <td>{{ company.name }}</td>
              <td>{{ company.cnpj || "-" }}</td>
              <td>{{ company.email || "-" }}</td>
              <td>{{ company.phone || "-" }}</td>
              <td>
                <span :class="['badge', company.isActive ? 'badge--success' : 'badge--danger']">
                  {{ company.isActive ? "Ativa" : "Inativa" }}
                </span>
              </td>
              <td>{{ company._count?.users || 0 }}</td>
              <td>{{ company._count?.employees || 0 }}</td>
              <td>{{ company._count?.events || 0 }}</td>
              <td>
                <div class="action-buttons">
                  <button
                    class="btn btn-sm btn-ghost"
                    type="button"
                    @click="manageCompany(company.id)"
                  >
                    Gerenciar
                  </button>
                  <button
                    class="btn btn-sm btn-ghost"
                    type="button"
                    @click="editCompany(company)"
                  >
                    Editar
                  </button>
                  <button
                    class="btn btn-sm btn-ghost btn-danger"
                    type="button"
                    @click="confirmDelete(company)"
                    :disabled="
                      (company._count?.users || 0) > 0 ||
                      (company._count?.employees || 0) > 0 ||
                      (company._count?.events || 0) > 0
                    "
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Criar/Editar Empresa -->
    <div v-if="showCreateModal || editingCompany" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ editingCompany ? "Editar Empresa" : "Nova Empresa" }}</h3>
          <button class="btn btn-ghost btn-sm" type="button" @click="closeModal">×</button>
        </div>
        <form class="form" @submit.prevent="handleSubmit">
          <div v-if="modalError" class="alert alert-error" style="margin-bottom: 1rem">
            {{ modalError }}
            <div v-if="modalErrorDetails" style="margin-top: 0.5rem; font-size: 0.875rem; opacity: 0.8;">
              {{ modalErrorDetails }}
            </div>
          </div>
          <label class="field">
            <span class="label">Nome <span class="required-indicator">*</span></span>
            <input v-model="form.name" class="input" type="text" required />
          </label>
          <label class="field">
            <span class="label">CNPJ</span>
            <input v-model="form.cnpj" class="input" type="text" placeholder="00.000.000/0000-00" />
          </label>
          <div class="form-row">
            <label class="field">
              <span class="label">Email</span>
              <input v-model="form.email" class="input" type="email" placeholder="empresa@exemplo.com" />
            </label>
            <label class="field">
              <span class="label">Telefone</span>
              <input v-model="form.phone" class="input" type="text" placeholder="(00) 0000-0000" />
            </label>
          </div>
          <label class="field">
            <span class="label">Endereço</span>
            <input v-model="form.address" class="input" type="text" />
          </label>
          <div class="form-row">
            <label class="field">
              <span class="label">Cidade</span>
              <input v-model="form.city" class="input" type="text" />
            </label>
            <label class="field">
              <span class="label">Estado</span>
              <input v-model="form.state" class="input" type="text" placeholder="UF" maxlength="2" />
            </label>
            <label class="field">
              <span class="label">CEP</span>
              <input v-model="form.zipCode" class="input" type="text" placeholder="00000-000" />
            </label>
          </div>
          <label class="field">
            <input
              v-model="form.isActive"
              class="checkbox"
              type="checkbox"
            />
            <span class="label">Empresa ativa</span>
          </label>
          <div class="panel-actions">
            <button class="btn btn-ghost" type="button" @click="closeModal">Cancelar</button>
            <button class="btn btn-primary" type="submit" :disabled="submitting">
              {{ submitting ? "Salvando..." : "Salvar" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../services/api";
import { getErrorMessage, getErrorDetails } from "../utils/errors";

const router = useRouter();

type Company = {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isActive: boolean;
  _count?: {
    users: number;
    employees: number;
    events: number;
  };
};

const companies = ref<Company[]>([]);
const loading = ref(true);
const error = ref("");
const errorDetails = ref("");
const showCreateModal = ref(false);
const editingCompany = ref<Company | null>(null);
const submitting = ref(false);
const modalError = ref("");
const modalErrorDetails = ref("");

const form = ref({
  name: "",
  cnpj: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  isActive: true,
});

const loadCompanies = async () => {
  loading.value = true;
  error.value = "";
  errorDetails.value = "";
  try {
    companies.value = await api.get<Company[]>("/super-admin/companies");
  } catch (err) {
    error.value = getErrorMessage(err);
    const details = getErrorDetails(err);
    if (details.code || details.status) {
      errorDetails.value = `Código: ${details.code || "N/A"} | Status: ${details.status || "N/A"}`;
      if (details.details) {
        errorDetails.value += ` | Detalhes: ${JSON.stringify(details.details)}`;
      }
    }
    console.error("Erro ao carregar empresas:", err);
  } finally {
    loading.value = false;
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  editingCompany.value = null;
  modalError.value = "";
  modalErrorDetails.value = "";
  form.value = {
    name: "",
    cnpj: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    isActive: true,
  };
};

const editCompany = (company: Company) => {
  editingCompany.value = company;
  form.value = {
    name: company.name,
    cnpj: company.cnpj || "",
    phone: company.phone || "",
    email: company.email || "",
    address: company.address || "",
    city: company.city || "",
    state: company.state || "",
    zipCode: company.zipCode || "",
    isActive: company.isActive,
  };
};

const handleSubmit = async () => {
  submitting.value = true;
  modalError.value = "";
  modalErrorDetails.value = "";
  // Limpa campos vazios antes de enviar
  const payload: any = {
    name: form.value.name.trim(),
    isActive: form.value.isActive,
  };
  
  if (form.value.cnpj && form.value.cnpj.trim()) {
    payload.cnpj = form.value.cnpj.trim();
  }
  if (form.value.phone && form.value.phone.trim()) {
    payload.phone = form.value.phone.trim();
  }
  if (form.value.email && form.value.email.trim()) {
    payload.email = form.value.email.trim();
  } else {
    // Se email estiver vazio, envia null ao invés de string vazia
    payload.email = null;
  }
  if (form.value.address && form.value.address.trim()) {
    payload.address = form.value.address.trim();
  }
  if (form.value.city && form.value.city.trim()) {
    payload.city = form.value.city.trim();
  }
  if (form.value.state && form.value.state.trim()) {
    payload.state = form.value.state.trim();
  }
  if (form.value.zipCode && form.value.zipCode.trim()) {
    payload.zipCode = form.value.zipCode.trim();
  }

  try {
    if (editingCompany.value) {
      await api.patch(`/super-admin/companies/${editingCompany.value.id}`, payload);
    } else {
      await api.post("/super-admin/companies", payload);
    }
    await loadCompanies();
    closeModal();
  } catch (err: any) {
    modalError.value = getErrorMessage(err);
    const details = getErrorDetails(err);
    if (details.code || details.status || details.details) {
      modalErrorDetails.value = `Código: ${details.code || "N/A"} | Status: ${details.status || "N/A"}`;
      if (details.details) {
        if (typeof details.details === 'string') {
          modalErrorDetails.value += ` | ${details.details}`;
        } else {
          modalErrorDetails.value += ` | ${JSON.stringify(details.details)}`;
        }
      }
    }
    console.error("Erro ao salvar empresa:", err);
  } finally {
    submitting.value = false;
  }
};

const confirmDelete = async (company: Company) => {
  if (
    !confirm(
      `Tem certeza que deseja excluir a empresa "${company.name}"? Esta ação não pode ser desfeita.`,
    )
  ) {
    return;
  }

  try {
    await api.delete(`/super-admin/companies/${company.id}`);
    await loadCompanies();
  } catch (err) {
    error.value = getErrorMessage(err);
    alert(getErrorMessage(err));
  }
};

const manageCompany = (id: string) => {
  router.push(`/super-admin/companies/${id}`);
  // Navegar para página de detalhes (implementar depois)
  console.log("View company:", id);
};

onMounted(() => {
  loadCompanies();
});
</script>

<style scoped>
.table-container {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.table th {
  font-weight: 600;
  background-color: #f5f6f8;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.btn-danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
}
</style>

