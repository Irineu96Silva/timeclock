<template>
  <section class="page-grid page-grid--single">
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("admin.exports.title") }}</h2>
        <p class="card-subtitle">{{ t("admin.exports.subtitle") }}</p>
      </div>

      <div v-if="loading" class="muted">{{ t("admin.exports.loadingEmployees") }}</div>
      <form v-else class="form" @submit.prevent="handleDownload">
        <label class="field">
          <span class="label">{{ t("admin.exports.employeeLabel") }}</span>
          <select v-model="selectedEmployeeId" class="input" required>
            <option value="" disabled>{{ t("admin.exports.employeePlaceholder") }}</option>
            <option v-for="employee in employees" :key="employee.id" :value="employee.id">
              {{ employee.fullName }}
            </option>
          </select>
        </label>

        <div class="form-row">
          <label class="field">
            <span class="label">{{ t("admin.exports.fromLabel") }}</span>
            <input v-model="from" class="input" type="date" required />
          </label>
          <label class="field">
            <span class="label">{{ t("admin.exports.toLabel") }}</span>
            <input v-model="to" class="input" type="date" required />
          </label>
        </div>

        <label class="field">
          <span class="label">Formato de Exportação</span>
          <select v-model="exportFormat" class="input">
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
        </label>

        <div class="panel-actions">
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="exporting || employees.length === 0"
          >
            {{ exporting ? t("admin.exports.downloading") : `Baixar ${exportFormat.toUpperCase()}` }}
          </button>
          <button
            v-if="employees.length > 0"
            class="btn btn-secondary"
            type="button"
            @click="handleBulkExport"
            :disabled="exporting"
          >
            {{ exporting ? "Exportando..." : "Exportar Todos (Excel)" }}
          </button>
        </div>
      </form>

      <div v-if="!loading && employees.length === 0" class="muted">
        {{ t("admin.exports.empty") }}
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { t } from "../i18n";
import { api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type EmployeeOption = {
  id: string;
  fullName: string;
};

const employees = ref<EmployeeOption[]>([]);
const loading = ref(true);
const exporting = ref(false);
const error = ref("");
const selectedEmployeeId = ref("");
const from = ref("");
const to = ref("");
const exportFormat = ref<"csv" | "xlsx">("xlsx");

const selectedEmployee = computed(() =>
  employees.value.find((employee) => employee.id === selectedEmployeeId.value),
);

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const setDefaultRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  from.value = toInputDate(start);
  to.value = toInputDate(end);
};

const loadEmployees = async () => {
  loading.value = true;
  error.value = "";
  try {
    employees.value = await api.get<EmployeeOption[]>("/employees");
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const buildFilename = (name: string, fromValue: string, toValue: string, extension: string = "csv") => {
  const safeName = name.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  const fromMonth = fromValue.slice(0, 7);
  const toMonth = toValue.slice(0, 7);
  const period = fromMonth === toMonth ? fromMonth : `${fromValue}_a_${toValue}`;
  return `pontos_${safeName || "colaborador"}_${period}.${extension}`;
};

const handleDownload = async () => {
  error.value = "";
  if (!selectedEmployeeId.value || !selectedEmployee.value) {
    error.value = t("admin.exports.errors.employeeRequired");
    return;
  }
  if (!from.value || !to.value) {
    error.value = t("admin.exports.errors.invalidRange");
    return;
  }

  exporting.value = true;
  try {
    const query = new URLSearchParams({ from: from.value, to: to.value });
    const extension = exportFormat.value;
    const blob = await api.getBlob(
      `/admin/exports/employees/${selectedEmployeeId.value}.${extension}?${query.toString()}`,
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      buildFilename(selectedEmployee.value.fullName, from.value, to.value, extension),
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    exporting.value = false;
  }
};

const handleBulkExport = async () => {
  error.value = "";
  if (!from.value || !to.value) {
    error.value = t("admin.exports.errors.invalidRange");
    return;
  }

  exporting.value = true;
  try {
    const employeeIds = employees.value.map((e) => e.id);
    const blob = await api.postBlob("/admin/exports/bulk.xlsx", {
      employeeIds,
      from: from.value,
      to: to.value,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fromMonth = from.value.slice(0, 7);
    const toMonth = to.value.slice(0, 7);
    link.setAttribute("download", `pontos_lote_${fromMonth}_a_${toMonth}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    exporting.value = false;
  }
};

onMounted(async () => {
  setDefaultRange();
  await loadEmployees();
});
</script>
