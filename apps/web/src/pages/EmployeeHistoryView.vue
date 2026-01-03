<template>
  <section class="page-grid">
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("employee.history.title") }}</h2>
        <p class="card-subtitle">{{ t("employee.history.subtitle") }}</p>
      </div>

      <form class="form" @submit.prevent="handleSearch">
        <div class="quick-filters">
          <button class="btn btn-ghost btn-sm" type="button" @click="applyToday">
            {{ t("employee.history.quick.today") }}
          </button>
          <button class="btn btn-ghost btn-sm" type="button" @click="applyLast7Days">
            {{ t("employee.history.quick.last7") }}
          </button>
          <button class="btn btn-ghost btn-sm" type="button" @click="applyCurrentMonth">
            {{ t("employee.history.quick.month") }}
          </button>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="label">{{ t("employee.history.fromLabel") }}</span>
            <input v-model="from" class="input" type="date" required />
          </label>
          <label class="field">
            <span class="label">{{ t("employee.history.toLabel") }}</span>
            <input v-model="to" class="input" type="date" required />
          </label>
        </div>

        <div class="panel-actions">
          <button class="btn btn-primary" type="submit" :disabled="loading">
            {{ loading ? t("employee.history.searching") : t("employee.history.search") }}
          </button>
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            :disabled="events.length === 0"
            @click="exportCsv"
          >
            {{ t("employee.history.exportCsv") }}
          </button>
          <router-link class="btn btn-ghost btn-sm" to="/employee/home">
            {{ t("employee.history.back") }}
          </router-link>
        </div>
      </form>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("employee.history.listTitle") }}</h2>
        <p class="card-subtitle">
          {{ t("employee.history.listSubtitle", { count: events.length }) }}
        </p>
      </div>

      <div v-if="loading" class="muted">{{ t("employee.history.loading") }}</div>
      <div v-else class="list">
        <div v-if="events.length === 0" class="muted">{{ t("employee.history.empty") }}</div>
        <div v-for="event in events" :key="event.id" class="event-row">
          <div>
            <strong>{{ formatType(event.type) }}</strong>
            <p class="muted">{{ formatDateTime(event.timestamp) }}</p>
          </div>
          <span class="badge badge--info">{{ formatType(event.type) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { t } from "../i18n";
import { api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type TimeClockEvent = {
  id: string;
  type: string;
  timestamp: string;
};

const from = ref("");
const to = ref("");
const loading = ref(false);
const error = ref("");
const events = ref<TimeClockEvent[]>([]);

const setDefaultRange = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  from.value = toInputDate(start);
  to.value = toInputDate(today);
};

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const handleSearch = async () => {
  if (!from.value || !to.value) {
    error.value = t("employee.history.invalidRange");
    return;
  }

  error.value = "";
  loading.value = true;
  try {
    const fromDate = new Date(`${from.value}T00:00:00`);
    const toDate = new Date(`${to.value}T23:59:59.999`);
    const query = new URLSearchParams({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    });
    events.value = await api.get<TimeClockEvent[]>(`/timeclock/me/history?${query.toString()}`);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const applyToday = async () => {
  const today = new Date();
  from.value = toInputDate(today);
  to.value = toInputDate(today);
  await handleSearch();
};

const applyLast7Days = async () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  from.value = toInputDate(start);
  to.value = toInputDate(today);
  await handleSearch();
};

const applyCurrentMonth = async () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  from.value = toInputDate(start);
  to.value = toInputDate(end);
  await handleSearch();
};

const exportCsv = () => {
  if (events.value.length === 0) {
    return;
  }
  const header = [t("employee.history.csv.type"), t("employee.history.csv.timestamp")];
  const rows = events.value.map((event) => [
    formatType(event.type),
    formatDateTime(event.timestamp),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `ponto-rh-historico-${from.value}-ate-${to.value}.csv`;
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatType = (type: string) => {
  switch (type) {
    case "IN":
      return t("types.in");
    case "BREAK_START":
      return t("types.breakStart");
    case "BREAK_END":
      return t("types.breakEnd");
    case "OUT":
      return t("types.out");
    default:
      return type;
  }
};

const formatDateTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

onMounted(async () => {
  setDefaultRange();
  await handleSearch();
});
</script>
