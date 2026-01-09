<template>
  <section class="page-grid page-grid--single">
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("admin.settings.title") }}</h2>
        <p class="card-subtitle">{{ t("admin.settings.subtitle") }}</p>
      </div>

      <p class="muted">{{ t("admin.settings.hint") }}</p>

      <div v-if="loading" class="muted">{{ t("admin.settings.loading") }}</div>
      <form v-else class="form" @submit.prevent="handleSave">
        <div class="form-row">
          <label class="field">
            <span class="label">{{ t("admin.settings.latitude") }}</span>
            <input v-model.number="form.geofenceLat" class="input" type="number" step="0.000001" />
          </label>
          <label class="field">
            <span class="label">{{ t("admin.settings.longitude") }}</span>
            <input v-model.number="form.geofenceLng" class="input" type="number" step="0.000001" />
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="label">{{ t("admin.settings.radius") }}</span>
            <input
              v-model.number="form.geofenceRadiusMeters"
              class="input"
              type="number"
              min="1"
            />
          </label>
          <label class="field">
            <span class="label">{{ t("admin.settings.accuracy") }}</span>
            <input v-model.number="form.maxAccuracyMeters" class="input" type="number" min="1" />
          </label>
        </div>

        <label class="field">
          <span class="label">{{ t("admin.settings.geofenceEnabled") }}</span>
          <input v-model="form.geofenceEnabled" type="checkbox" />
        </label>

        <label class="field">
          <span class="label">{{ t("admin.settings.geoRequired") }}</span>
          <input v-model="form.geoRequired" type="checkbox" />
        </label>

        <div class="section">
          <h3 class="section-title">{{ t("admin.settings.qrSection.title") }}</h3>
          <p class="section-subtitle">{{ t("admin.settings.qrSection.subtitle") }}</p>

          <label class="field">
            <span class="label">{{ t("admin.settings.qrSection.enabled") }}</span>
            <input v-model="form.qrEnabled" type="checkbox" />
          </label>

          <label class="field">
            <span class="label">{{ t("admin.settings.qrSection.mode") }}</span>
            <select v-model="form.punchFallbackMode" class="input">
              <option value="GEO_ONLY">{{ t("admin.settings.qrSection.modeGeoOnly") }}</option>
              <option value="GEO_OR_QR">{{ t("admin.settings.qrSection.modeGeoOrQr") }}</option>
              <option value="QR_ONLY">{{ t("admin.settings.qrSection.modeQrOnly") }}</option>
            </select>
          </label>

          <button
            class="btn btn-ghost btn-sm"
            type="button"
            :disabled="regeneratingSecret"
            @click="handleRegenerateSecret"
          >
            {{
              regeneratingSecret
                ? t("admin.settings.qrSection.regenerating")
                : t("admin.settings.qrSection.regenerate")
            }}
          </button>
        </div>

        <div class="section">
          <h3 class="section-title">Jornada de Trabalho Padrão</h3>
          <p class="section-subtitle">
            Configure a jornada padrão que será aplicada aos novos funcionários
          </p>

          <div class="form-row">
            <label class="field">
              <span class="label">Entrada</span>
              <input v-model="form.defaultWorkStartTime" class="input" type="time" />
            </label>
            <label class="field">
              <span class="label">Saída</span>
              <input v-model="form.defaultWorkEndTime" class="input" type="time" />
            </label>
          </div>

          <div class="form-row">
            <label class="field">
              <span class="label">Início do Almoço</span>
              <input v-model="form.defaultBreakStartTime" class="input" type="time" />
            </label>
            <label class="field">
              <span class="label">Fim do Almoço</span>
              <input v-model="form.defaultBreakEndTime" class="input" type="time" />
            </label>
          </div>

          <div class="form-row">
            <label class="field">
              <span class="label">Tolerância (minutos)</span>
              <input
                v-model.number="form.defaultToleranceMinutes"
                class="input"
                type="number"
                min="0"
              />
            </label>
            <label class="field">
              <span class="label">Fuso Horário</span>
              <select v-model="form.defaultTimezone" class="input">
                <option value="America/Sao_Paulo">America/Sao_Paulo (Brasil)</option>
                <option value="America/Manaus">America/Manaus (Amazonas)</option>
                <option value="America/Fortaleza">America/Fortaleza (Nordeste)</option>
                <option value="America/Campo_Grande">America/Campo_Grande (Mato Grosso)</option>
                <option value="America/Acre">America/Acre (Acre)</option>
              </select>
            </label>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">{{ t("admin.settings.kioskSection.title") }}</h3>
          <p class="section-subtitle">{{ t("admin.settings.kioskSection.subtitle") }}</p>

          <label class="field">
            <span class="label">{{ t("admin.settings.kioskSection.deviceLabel") }}</span>
            <input
              v-model="form.kioskDeviceLabel"
              class="input"
              type="text"
              :placeholder="t('admin.settings.kioskSection.devicePlaceholder')"
            />
          </label>
          <p class="muted">{{ t("admin.settings.kioskSection.deviceHint") }}</p>

          <label class="field">
            <span class="label">{{ t("admin.settings.kioskSection.emailLabel") }}</span>
            <input
              v-model="kioskEmail"
              class="input"
              type="email"
              :placeholder="t('admin.settings.kioskSection.emailPlaceholder')"
            />
          </label>
          <p class="muted">{{ t("admin.settings.kioskSection.hint") }}</p>

          <button
            class="btn btn-primary btn-sm"
            type="button"
            :disabled="creatingKiosk"
            @click="handleCreateKiosk"
          >
            {{
              creatingKiosk
                ? t("admin.settings.kioskSection.creating")
                : t("admin.settings.kioskSection.create")
            }}
          </button>

          <div v-if="kioskError" class="alert alert-error">{{ kioskError }}</div>
        </div>

        <div class="panel-actions">
          <button class="btn btn-primary" type="submit" :disabled="saving">
            {{ saving ? t("admin.settings.saving") : t("admin.settings.save") }}
          </button>
          <router-link class="btn btn-ghost btn-sm" to="/admin/employees">
            {{ t("admin.employees.listTitle") }}
          </router-link>
        </div>
      </form>

      <div v-if="success" class="alert alert-success">{{ success }}</div>
      <div v-if="error" class="alert alert-error">
        <div><strong>Erro:</strong> {{ error }}</div>
        <div v-if="errorDetails" style="margin-top: 0.5rem; font-size: 0.875rem; opacity: 0.8;">
          {{ errorDetails }}
        </div>
      </div>
    </div>
  </section>

  <div v-if="kioskModal" class="modal-backdrop" @click.self="closeKioskModal">
    <div class="modal">
      <div class="modal-header">
        <h3>{{ t("admin.settings.kioskSection.modalTitle") }}</h3>
        <p>
          {{
            t("admin.settings.kioskSection.modalSubtitle", {
              email: kioskModal.email,
            })
          }}
        </p>
      </div>
      <div class="modal-body">
        <code class="code-chip">{{ kioskModal.password }}</code>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" @click="copyKioskPassword">
          {{
            kioskCopied
              ? t("admin.settings.kioskSection.copied")
              : t("admin.settings.kioskSection.copy")
          }}
        </button>
        <button class="btn btn-ghost" type="button" @click="closeKioskModal">
          {{ t("admin.settings.kioskSection.close") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { t } from "../i18n";
import { api, ApiError } from "../services/api";
import { getErrorMessage, getErrorDetails } from "../utils/errors";

type SettingsResponse = {
  geofenceEnabled: boolean;
  geoRequired: boolean;
  geofenceLat: number;
  geofenceLng: number;
  geofenceRadiusMeters: number;
  maxAccuracyMeters: number;
  qrEnabled: boolean;
  punchFallbackMode: "GEO_ONLY" | "GEO_OR_QR" | "QR_ONLY";
  kioskDeviceLabel: string;
  defaultWorkStartTime: string | null;
  defaultBreakStartTime: string | null;
  defaultBreakEndTime: string | null;
  defaultWorkEndTime: string | null;
  defaultToleranceMinutes: number | null;
  defaultTimezone: string | null;
};

const form = reactive<SettingsResponse>({
  geofenceEnabled: true,
  geoRequired: true,
  geofenceLat: 0,
  geofenceLng: 0,
  geofenceRadiusMeters: 200,
  maxAccuracyMeters: 100,
  qrEnabled: true,
  punchFallbackMode: "GEO_OR_QR",
  kioskDeviceLabel: "",
  defaultWorkStartTime: "08:00",
  defaultBreakStartTime: "12:00",
  defaultBreakEndTime: "13:00",
  defaultWorkEndTime: "17:00",
  defaultToleranceMinutes: 5,
  defaultTimezone: "America/Sao_Paulo",
});

const loading = ref(true);
const saving = ref(false);
const error = ref("");
const errorDetails = ref("");
const success = ref("");
const regeneratingSecret = ref(false);
const creatingKiosk = ref(false);
const kioskEmail = ref("");
const kioskError = ref("");
const kioskModal = ref<{ email: string; password: string } | null>(null);
const kioskCopied = ref(false);

const loadSettings = async () => {
  loading.value = true;
  error.value = "";
  errorDetails.value = "";
  try {
    const data = await api.get<SettingsResponse>("/admin/settings");
    Object.assign(form, data);
  } catch (err) {
    error.value = getErrorMessage(err);
    const details = getErrorDetails(err);
    if (details.code || details.status) {
      errorDetails.value = `Código: ${details.code || "N/A"} | Status: ${details.status || "N/A"}`;
      if (details.details) {
        errorDetails.value += ` | Detalhes: ${JSON.stringify(details.details)}`;
      }
    }
    console.error("Erro ao carregar configurações:", err);
  } finally {
    loading.value = false;
  }
};

const handleSave = async () => {
  error.value = "";
  errorDetails.value = "";
  success.value = "";
  saving.value = true;
  try {
    const data = await api.patch<SettingsResponse>("/admin/settings", {
      geofenceLat: form.geofenceLat,
      geofenceLng: form.geofenceLng,
      geofenceRadiusMeters: form.geofenceRadiusMeters,
      maxAccuracyMeters: form.maxAccuracyMeters,
      geofenceEnabled: form.geofenceEnabled,
      geoRequired: form.geoRequired,
      qrEnabled: form.qrEnabled,
      punchFallbackMode: form.punchFallbackMode,
      kioskDeviceLabel: form.kioskDeviceLabel.trim(),
      defaultWorkStartTime: form.defaultWorkStartTime,
      defaultBreakStartTime: form.defaultBreakStartTime,
      defaultBreakEndTime: form.defaultBreakEndTime,
      defaultWorkEndTime: form.defaultWorkEndTime,
      defaultToleranceMinutes: form.defaultToleranceMinutes,
      defaultTimezone: form.defaultTimezone,
    });
    Object.assign(form, data);
    success.value = t("admin.settings.saved");
  } catch (err) {
    error.value = getErrorMessage(err);
    const details = getErrorDetails(err);
    if (details.code || details.status) {
      errorDetails.value = `Código: ${details.code || "N/A"} | Status: ${details.status || "N/A"}`;
      if (details.details) {
        errorDetails.value += ` | Detalhes: ${JSON.stringify(details.details)}`;
      }
    }
    console.error("Erro ao salvar configurações:", err);
  } finally {
    saving.value = false;
  }
};

const handleRegenerateSecret = async () => {
  const confirmAction = window.confirm(t("admin.settings.qrSection.confirm"));
  if (!confirmAction) {
    return;
  }
  regeneratingSecret.value = true;
  error.value = "";
  try {
    await api.post("/admin/settings/qr/regenerate-secret");
    success.value = t("admin.settings.qrSection.regenerated");
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    regeneratingSecret.value = false;
  }
};

const handleCreateKiosk = async () => {
  kioskError.value = "";
  creatingKiosk.value = true;
  kioskModal.value = null;
  try {
    const payload = kioskEmail.value.trim() ? { email: kioskEmail.value.trim() } : undefined;
    const response = await api.post<{ email: string; temporaryPassword: string }>(
      "/admin/kiosk-user",
      payload,
    );
    kioskEmail.value = "";
    openKioskModal(response.email, response.temporaryPassword);
  } catch (err) {
    kioskError.value = getErrorMessage(err);
  } finally {
    creatingKiosk.value = false;
  }
};

const openKioskModal = (email: string, password: string) => {
  kioskCopied.value = false;
  kioskModal.value = { email, password };
};

const closeKioskModal = () => {
  kioskModal.value = null;
  kioskCopied.value = false;
};

const copyKioskPassword = async () => {
  if (!kioskModal.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(kioskModal.value.password);
    kioskCopied.value = true;
    window.setTimeout(() => {
      kioskCopied.value = false;
    }, 1500);
  } catch {
    kioskCopied.value = false;
  }
};

onMounted(loadSettings);
</script>
