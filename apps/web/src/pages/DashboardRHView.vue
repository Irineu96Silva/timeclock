<template>
  <section class="dashboard-stack">
    <div class="card">
      <div class="card-header card-header--row">
        <div>
          <h2 class="card-title">{{ t("admin.dashboard.title") }}</h2>
          <p class="card-subtitle">{{ t("admin.dashboard.subtitle") }}</p>
        </div>
        <div class="summary-meta">
          <span class="badge badge--info">
            {{
              t("admin.dashboard.activeEmployees", {
                count: summary?.totalActiveEmployees ?? 0,
              })
            }}
          </span>
          <p class="muted">
            {{ t("admin.dashboard.dateLabel") }}: {{ summary?.date ?? "-" }}
          </p>
        </div>
      </div>

      <div v-if="loading" class="muted">{{ t("admin.dashboard.loading") }}</div>
      <div v-else class="stats-grid">
        <div class="stat-card stat-card--success">
          <span class="stat-label">{{ t("admin.dashboard.cards.working") }}</span>
          <strong class="stat-value">{{ summary?.workingNow ?? 0 }}</strong>
        </div>
        <div class="stat-card stat-card--warning">
          <span class="stat-label">{{ t("admin.dashboard.cards.break") }}</span>
          <strong class="stat-value">{{ summary?.onBreakNow ?? 0 }}</strong>
        </div>
        <div class="stat-card stat-card--neutral">
          <span class="stat-label">{{ t("admin.dashboard.cards.out") }}</span>
          <strong class="stat-value">{{ summary?.outNow ?? 0 }}</strong>
        </div>
        <div class="stat-card stat-card--info">
          <span class="stat-label">{{ t("admin.dashboard.cards.notStarted") }}</span>
          <strong class="stat-value">{{ summary?.notStartedYet ?? 0 }}</strong>
        </div>
        <div class="stat-card stat-card--danger">
          <span class="stat-label">{{ t("admin.dashboard.cards.blocked") }}</span>
          <strong class="stat-value">{{ summary?.blockedAttemptsToday ?? 0 }}</strong>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
    </div>

    <div class="card">
      <div class="card-header card-header--row">
        <div>
          <h3 class="card-title">{{ t("admin.dashboard.liveTitle") }}</h3>
          <p class="card-subtitle">
            {{ liveSubtitle }}
          </p>
        </div>
        <div class="live-controls">
          <label class="field field--inline">
            <span class="label">{{ t("admin.dashboard.filterLabel") }}</span>
            <select v-model="statusFilter" class="input input--sm">
              <option value="ALL">{{ t("admin.dashboard.filterAll") }}</option>
              <option value="WORKING">{{ t("admin.dashboard.status.working") }}</option>
              <option value="BREAK">{{ t("admin.dashboard.status.break") }}</option>
              <option value="OUT">{{ t("admin.dashboard.status.out") }}</option>
              <option value="NOT_STARTED">
                {{ t("admin.dashboard.status.notStarted") }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <div v-if="loading" class="muted">{{ t("admin.dashboard.loading") }}</div>
      <div v-else>
        <div v-if="filteredLiveItems.length === 0" class="muted">
          {{ t("admin.dashboard.empty") }}
        </div>
        <div v-else class="live-table">
          <div class="live-header">
            <span>{{ t("admin.dashboard.columns.name") }}</span>
            <span>{{ t("admin.dashboard.columns.status") }}</span>
            <span>{{ t("admin.dashboard.columns.lastEvent") }}</span>
            <span>{{ t("admin.dashboard.columns.location") }}</span>
            <span>{{ t("admin.dashboard.columns.blocked") }}</span>
          </div>
          <div v-for="item in filteredLiveItems" :key="item.employeeId" class="live-row">
            <div class="live-cell">
              <strong>{{ item.fullName }}</strong>
              <p class="muted">{{ item.email }}</p>
            </div>
            <div class="live-cell">
              <span :class="['badge', statusBadgeClass(item.statusNow)]">
                {{ statusLabel(item.statusNow) }}
              </span>
            </div>
            <div class="live-cell">
              <span class="muted">{{ formatLastEvent(item) }}</span>
            </div>
            <div class="live-cell">
              <span v-if="item.geoStatus" :class="['badge', geoBadgeClass(item.geoStatus)]">
                {{ formatLocation(item) }}
              </span>
              <span v-else class="muted">-</span>
            </div>
            <div class="live-cell">
              <span
                :class="[
                  'badge',
                  item.blockedAttemptsToday > 0 ? 'badge--danger' : 'badge--info',
                ]"
              >
                {{ item.blockedAttemptsToday }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { t } from "../i18n";
import { api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type DashboardSummary = {
  date: string;
  totalActiveEmployees: number;
  workingNow: number;
  onBreakNow: number;
  outNow: number;
  notStartedYet: number;
  blockedAttemptsToday: number;
  lastUpdatedAt: string;
};

type StatusNow = "WORKING" | "BREAK" | "OUT" | "NOT_STARTED";
type GeoStatus = "OK" | "OUTSIDE" | "LOW_ACCURACY" | "MISSING";

type LiveItem = {
  employeeId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  statusNow: StatusNow;
  lastEventType: "IN" | "BREAK_START" | "BREAK_END" | "OUT" | null;
  lastEventTime: string | null;
  geoStatus: GeoStatus | null;
  lastDistanceMeters: number | null;
  blockedAttemptsToday: number;
};

type StatusFilter = "ALL" | StatusNow;

const summary = ref<DashboardSummary | null>(null);
const liveItems = ref<LiveItem[]>([]);
const loading = ref(true);
const error = ref("");
const statusFilter = ref<StatusFilter>("ALL");
const lastUpdatedAt = ref<Date | null>(null);
const secondsSinceUpdate = ref(0);
const pollingIntervalSeconds = 10;
const nextUpdateIn = ref(pollingIntervalSeconds);
const refreshing = ref(false);

let timerId: number | undefined;

const filteredLiveItems = computed(() => {
  if (statusFilter.value === "ALL") {
    return liveItems.value;
  }
  return liveItems.value.filter((item) => item.statusNow === statusFilter.value);
});

const liveSubtitle = computed(() => {
  if (!lastUpdatedAt.value) {
    return `${t("admin.dashboard.waiting")} - ${t("admin.dashboard.nextUpdate", {
      seconds: nextUpdateIn.value,
    })}`;
  }
  const updatedLabel =
    secondsSinceUpdate.value <= 1
      ? t("admin.dashboard.updatedNow")
      : t("admin.dashboard.updatedSeconds", { seconds: secondsSinceUpdate.value });
  return `${updatedLabel} - ${t("admin.dashboard.nextUpdate", { seconds: nextUpdateIn.value })}`;
});

const loadDashboard = async (silent = false) => {
  if (refreshing.value) {
    return;
  }
  refreshing.value = true;
  if (!silent) {
    loading.value = true;
  }
  error.value = "";

  try {
    const [summaryData, liveData] = await Promise.all([
      api.get<DashboardSummary>("/admin/dashboard/summary"),
      api.get<LiveItem[]>("/admin/dashboard/live"),
    ]);
    summary.value = summaryData;
    liveItems.value = liveData;
    lastUpdatedAt.value = new Date(summaryData.lastUpdatedAt);
    secondsSinceUpdate.value = 0;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    refreshing.value = false;
    if (!silent) {
      loading.value = false;
    }
  }
};

const statusLabel = (status: StatusNow) => {
  switch (status) {
    case "WORKING":
      return t("admin.dashboard.status.working");
    case "BREAK":
      return t("admin.dashboard.status.break");
    case "OUT":
      return t("admin.dashboard.status.out");
    case "NOT_STARTED":
    default:
      return t("admin.dashboard.status.notStarted");
  }
};

const statusBadgeClass = (status: StatusNow) => {
  switch (status) {
    case "WORKING":
      return "badge--success";
    case "BREAK":
      return "badge--warning";
    case "OUT":
      return "badge--danger";
    case "NOT_STARTED":
    default:
      return "badge--info";
  }
};

const geoLabel = (status: GeoStatus) => {
  switch (status) {
    case "OK":
      return t("admin.dashboard.geo.ok");
    case "OUTSIDE":
      return t("admin.dashboard.geo.outside");
    case "LOW_ACCURACY":
      return t("admin.dashboard.geo.lowAccuracy");
    case "MISSING":
    default:
      return t("admin.dashboard.geo.missing");
  }
};

const geoBadgeClass = (status: GeoStatus) => {
  switch (status) {
    case "OK":
      return "badge--success";
    case "OUTSIDE":
      return "badge--danger";
    case "LOW_ACCURACY":
      return "badge--warning";
    case "MISSING":
    default:
      return "badge--info";
  }
};

const formatEventType = (type: LiveItem["lastEventType"]) => {
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
      return "-";
  }
};

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatLastEvent = (item: LiveItem) => {
  if (!item.lastEventType || !item.lastEventTime) {
    return "-";
  }
  return `${formatEventType(item.lastEventType)} - ${formatTime(item.lastEventTime)}`;
};

const formatLocation = (item: LiveItem) => {
  if (!item.geoStatus) {
    return "-";
  }
  const label = geoLabel(item.geoStatus);
  if (item.lastDistanceMeters === null || item.lastDistanceMeters === undefined) {
    return label;
  }
  return `${label} (${Math.round(item.lastDistanceMeters)} m)`;
};

const startPolling = () => {
  if (timerId) {
    window.clearInterval(timerId);
  }
  nextUpdateIn.value = pollingIntervalSeconds;
  timerId = window.setInterval(() => {
    if (nextUpdateIn.value <= 1) {
      nextUpdateIn.value = pollingIntervalSeconds;
      void loadDashboard(true);
    } else {
      nextUpdateIn.value -= 1;
    }
    if (lastUpdatedAt.value) {
      secondsSinceUpdate.value += 1;
    }
  }, 1000);
};

onMounted(async () => {
  await loadDashboard();
  startPolling();
});

onUnmounted(() => {
  if (timerId) {
    window.clearInterval(timerId);
  }
});
</script>
