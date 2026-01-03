<template>
  <section class="page-grid">
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("admin.employees.createTitle") }}</h2>
        <p class="card-subtitle">{{ t("admin.employees.createSubtitle") }}</p>
      </div>

      <form class="form" @submit.prevent="handleCreate">
        <label class="field">
          <span class="label">{{ t("admin.employees.nameLabel") }}</span>
          <input
            v-model="form.fullName"
            class="input"
            type="text"
            :placeholder="t('admin.employees.namePlaceholder')"
            required
          />
        </label>

        <label class="field">
          <span class="label">{{ t("admin.employees.emailLabel") }}</span>
          <input
            v-model="form.email"
            class="input"
            type="email"
            :placeholder="t('admin.employees.emailPlaceholder')"
            required
          />
        </label>

        <label class="field">
          <span class="label">{{ t("admin.employees.documentLabel") }}</span>
          <input
            v-model="form.document"
            class="input"
            type="text"
            :placeholder="t('admin.employees.documentPlaceholder')"
          />
        </label>

        <button class="btn btn-primary btn-block" type="submit" :disabled="creating">
          {{ creating ? t("admin.employees.creatingButton") : t("admin.employees.createButton") }}
        </button>
      </form>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
    </div>

    <div class="card">
      <div class="card-header card-header--row">
        <div>
          <h2 class="card-title">{{ t("admin.employees.listTitle") }}</h2>
          <p class="card-subtitle">{{ t("admin.employees.listSubtitle") }}</p>
        </div>
        <router-link class="btn btn-ghost btn-sm" to="/admin/settings">
          {{ t("admin.settings.title") }}
        </router-link>
      </div>

      <div v-if="loading" class="muted">{{ t("admin.employees.loading") }}</div>
      <div v-else class="list">
        <div v-if="employees.length === 0" class="muted">
          {{ t("admin.employees.empty") }}
        </div>
        <div v-for="employee in employees" :key="employee.id" class="list-item">
          <div>
            <strong>{{ employee.fullName }}</strong>
            <p class="muted">{{ employee.user.email }}</p>
          </div>
          <div class="list-actions">
            <div class="badge-group">
              <span class="badge badge--info">{{ roleLabel(employee.user.role) }}</span>
              <span
                :class="[
                  'badge',
                  employee.isActive ? 'badge--success' : 'badge--danger',
                ]"
              >
                {{ employee.isActive ? t("badges.active") : t("badges.inactive") }}
              </span>
            </div>
            <div class="list-actions">
              <button
                class="btn btn-ghost btn-sm"
                type="button"
                @click="openPinModal(employee)"
              >
                {{ t("admin.employees.setPin") }}
              </button>
              <button
                class="btn btn-ghost btn-sm"
                type="button"
                @click="handleGenerateQr(employee)"
              >
                {{ t("admin.employees.generateQr") }}
              </button>
              <button
                class="btn btn-ghost btn-sm"
                type="button"
                :disabled="resettingId === employee.id"
                @click="handleResetPassword(employee)"
              >
                {{
                  resettingId === employee.id
                    ? t("admin.employees.resettingPassword")
                    : t("admin.employees.resetPassword")
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <div v-if="passwordModal" class="modal-backdrop" @click.self="closeModal">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ t("admin.employees.passwordModal.title") }}</h3>
        <p>
          {{
            t("admin.employees.passwordModal.subtitle", {
              email: passwordModal.email,
            })
          }}
        </p>
      </div>
      <div class="modal-body">
        <code class="code-chip">{{ passwordModal.password }}</code>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" @click="copyPassword">
          {{
            copied ? t("admin.employees.passwordModal.copied") : t("admin.employees.passwordModal.copy")
          }}
        </button>
        <button class="btn btn-ghost" type="button" @click="closeModal">
          {{ t("admin.employees.passwordModal.close") }}
        </button>
      </div>
    </div>
  </div>

  <div v-if="pinModal" class="modal-backdrop" @click.self="closePinModal">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ t("admin.employees.pinModal.title") }}</h3>
        <p>
          {{
            t("admin.employees.pinModal.subtitle", {
              name: pinModal.fullName,
            })
          }}
        </p>
      </div>
      <div class="modal-body">
        <label class="field">
          <span class="label">{{ t("admin.employees.pinModal.label") }}</span>
          <input
            v-model="pinValue"
            class="input"
            type="text"
            inputmode="numeric"
            maxlength="4"
            :placeholder="t('admin.employees.pinModal.placeholder')"
          />
        </label>
        <div v-if="temporaryPin" class="status-card">
          <span class="muted">{{ t("admin.employees.pinModal.tempLabel") }}</span>
          <code class="code-chip">{{ temporaryPin }}</code>
        </div>
        <div v-if="pinError" class="alert alert-error">{{ pinError }}</div>
        <div v-if="pinSuccess" class="alert alert-success">{{ pinSuccess }}</div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" :disabled="pinSaving" @click="handleSavePin">
          {{
            pinSaving
              ? t("admin.employees.pinModal.saving")
              : t("admin.employees.pinModal.save")
          }}
        </button>
        <button
          class="btn btn-ghost"
          type="button"
          :disabled="pinSaving || pinResetting"
          @click="handleResetPin"
        >
          {{
            pinResetting
              ? t("admin.employees.pinModal.resetting")
              : t("admin.employees.pinModal.reset")
          }}
        </button>
        <button class="btn btn-ghost" type="button" @click="closePinModal">
          {{ t("admin.employees.pinModal.close") }}
        </button>
      </div>
    </div>
  </div>

  <div v-if="qrModal" class="modal-backdrop" @click.self="closeQrModal">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ t("admin.employees.qrModal.title") }}</h3>
        <p>
          {{
            t("admin.employees.qrModal.subtitle", {
              name: qrModal.fullName,
            })
          }}
        </p>
      </div>
      <div class="modal-body">
        <canvas ref="qrCanvasRef" class="kiosk-qr"></canvas>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" @click="copyQrToken">
          {{ copiedQr ? t("admin.employees.qrModal.copied") : t("admin.employees.qrModal.copy") }}
        </button>
        <button class="btn btn-ghost" type="button" @click="closeQrModal">
          {{ t("admin.employees.qrModal.close") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from "vue";
import QRCode from "qrcode";
import { t } from "../i18n";
import { api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type EmployeeItem = {
  id: string;
  fullName: string;
  document: string | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
  };
};

type CreateEmployeeResponse = {
  employeeId: string;
  userId: string;
  email: string;
  fullName: string;
  temporaryPassword?: string;
};

const employees = ref<EmployeeItem[]>([]);
const loading = ref(true);
const creating = ref(false);
const resettingId = ref<string | null>(null);
const error = ref("");
const passwordModal = ref<{ email: string; password: string } | null>(null);
const copied = ref(false);
const pinModal = ref<EmployeeItem | null>(null);
const pinValue = ref("");
const pinSaving = ref(false);
const pinResetting = ref(false);
const pinError = ref("");
const pinSuccess = ref("");
const temporaryPin = ref<string | null>(null);
const qrModal = ref<EmployeeItem | null>(null);
const qrToken = ref("");
const copiedQr = ref(false);
const qrCanvasRef = ref<HTMLCanvasElement | null>(null);

const form = reactive({
  fullName: "",
  email: "",
  document: "",
});

const loadEmployees = async () => {
  loading.value = true;
  try {
    employees.value = await api.get<EmployeeItem[]>("/employees");
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  error.value = "";
  creating.value = true;
  passwordModal.value = null;

  try {
    const payload = {
      fullName: form.fullName,
      email: form.email,
      document: form.document || undefined,
    };
    const response = await api.post<CreateEmployeeResponse>("/employees", payload);

    if (response.temporaryPassword) {
      openModal(response.email, response.temporaryPassword);
    }

    form.fullName = "";
    form.email = "";
    form.document = "";

    await loadEmployees();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    creating.value = false;
  }
};

const handleResetPassword = async (employee: EmployeeItem) => {
  error.value = "";
  resettingId.value = employee.id;
  passwordModal.value = null;

  try {
    const response = await api.post<{ temporaryPassword: string }>(
      `/employees/${employee.id}/reset-password`,
    );
    openModal(employee.user.email, response.temporaryPassword);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    resettingId.value = null;
  }
};

const roleLabel = (role: string) => {
  const normalized = role.trim().toUpperCase();
  if (normalized === "ADMIN") {
    return t("badges.admin");
  }
  if (normalized === "KIOSK") {
    return t("badges.kiosk");
  }
  return t("badges.employee");
};

const openModal = (email: string, password: string) => {
  copied.value = false;
  passwordModal.value = { email, password };
};

const closeModal = () => {
  passwordModal.value = null;
  copied.value = false;
};

const copyPassword = async () => {
  if (!passwordModal.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(passwordModal.value.password);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    copied.value = false;
  }
};

const openPinModal = (employee: EmployeeItem) => {
  pinModal.value = employee;
  pinValue.value = "";
  pinError.value = "";
  pinSuccess.value = "";
  temporaryPin.value = null;
};

const closePinModal = () => {
  pinModal.value = null;
  pinValue.value = "";
  pinError.value = "";
  pinSuccess.value = "";
  temporaryPin.value = null;
};

const handleSavePin = async () => {
  if (!pinModal.value) {
    return;
  }
  pinError.value = "";
  pinSuccess.value = "";
  temporaryPin.value = null;
  if (!/^\d{4}$/.test(pinValue.value)) {
    pinError.value = t("admin.employees.pinModal.invalid");
    return;
  }
  pinSaving.value = true;
  try {
    await api.post(`/employees/${pinModal.value.id}/pin`, { pin: pinValue.value });
    pinSuccess.value = t("admin.employees.pinModal.saved");
    pinValue.value = "";
  } catch (err) {
    pinError.value = getErrorMessage(err);
  } finally {
    pinSaving.value = false;
  }
};

const handleResetPin = async () => {
  if (!pinModal.value) {
    return;
  }
  pinError.value = "";
  pinSuccess.value = "";
  pinResetting.value = true;
  try {
    const response = await api.post<{ pin: string }>(`/employees/${pinModal.value.id}/pin/reset`);
    temporaryPin.value = response.pin;
    pinSuccess.value = t("admin.employees.pinModal.resetDone");
  } catch (err) {
    pinError.value = getErrorMessage(err);
  } finally {
    pinResetting.value = false;
  }
};

const handleGenerateQr = async (employee: EmployeeItem) => {
  qrModal.value = employee;
  copiedQr.value = false;
  qrToken.value = "";
  try {
    const response = await api.post<{ employeeQrToken: string }>(
      `/employees/${employee.id}/qr/regenerate`,
    );
    qrToken.value = response.employeeQrToken;
    await nextTick();
    if (qrCanvasRef.value) {
      await QRCode.toCanvas(qrCanvasRef.value, response.employeeQrToken, {
        width: 260,
        margin: 1,
      });
    }
  } catch (err) {
    error.value = getErrorMessage(err);
    qrModal.value = null;
  }
};

const closeQrModal = () => {
  qrModal.value = null;
  copiedQr.value = false;
  qrToken.value = "";
};

const copyQrToken = async () => {
  if (!qrToken.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(qrToken.value);
    copiedQr.value = true;
    window.setTimeout(() => {
      copiedQr.value = false;
    }, 1500);
  } catch {
    copiedQr.value = false;
  }
};

onMounted(loadEmployees);
</script>
