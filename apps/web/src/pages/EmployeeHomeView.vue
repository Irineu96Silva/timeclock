<template>
  <section class="page-grid">
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("employee.home.title") }}</h2>
        <p class="card-subtitle">{{ t("employee.home.subtitle") }}</p>
      </div>

      <button
        class="btn btn-primary btn-large btn-block"
        type="button"
        :disabled="punching || locating || isClosed"
        @click="handlePunch"
      >
        {{
          locating
            ? t("employee.home.locating")
            : punching
              ? t("employee.home.punching")
              : t("employee.home.punch")
        }}
      </button>

      <div class="status-card">
        <span class="muted">{{ t("employee.home.statusTitle") }}</span>
        <strong>{{ statusLabel }}</strong>
        <p v-if="nextLabel" class="muted">
          {{ t("employee.home.nextLabel") }}: {{ nextLabel }}
        </p>
      </div>

      <router-link class="btn btn-ghost btn-sm" to="/employee/history">
        {{ t("employee.home.historyLink") }}
      </router-link>

      <div v-if="isClosed" class="alert alert-warning">
        {{ t("employee.home.closedMessage") }}
      </div>

      <div v-if="feedback" class="alert alert-success">
        {{ feedback }}
      </div>

      <div v-if="error" class="alert alert-error">
        <p>{{ error }}</p>
        <p v-if="errorDetails" class="muted">{{ errorDetails }}</p>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{{ t("employee.home.todayTitle") }}</h2>
        <p class="card-subtitle">{{ t("employee.home.todaySubtitle") }}</p>
      </div>

      <div v-if="loading" class="muted">{{ t("employee.home.loading") }}</div>
      <div v-else class="list">
        <div v-if="events.length === 0" class="muted">{{ t("employee.home.noEvents") }}</div>
        <div v-for="event in events" :key="event.id" class="event-row">
          <div>
            <strong>{{ formatType(event.type) }}</strong>
            <p class="muted">{{ formatTime(event.timestamp) }}</p>
          </div>
          <span class="badge badge--info">{{ formatType(event.type) }}</span>
        </div>
      </div>
    </div>
  </section>

    <div v-if="showQrFallback" class="modal-backdrop" @click.self="closeQrFallback">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ t("employee.qrFallback.title") }}</h3>
          <p class="muted">{{ t("employee.qrFallback.subtitle") }}</p>
        </div>
        <p v-if="qrSubmitting" class="muted">{{ t("employee.qrFallback.submitting") }}</p>
        <div v-if="qrFallbackError" class="alert alert-warning">{{ qrFallbackError }}</div>
        <div class="modal-actions">
          <button
    class="btn btn-ghost"
    type="button"
    :disabled="qrSubmitting"
    @click="() => handleRetryGeo()"

  >
    {{ t("employee.qrFallback.retry") }}
  </button>

          <button
            class="btn btn-primary"
            type="button"
            :disabled="qrSubmitting"
            @click="openQrScanner"
          >
            {{ t("employee.qrFallback.scan") }}
          </button>
        </div>
      </div>
  </div>

  <QrScannerView v-if="showQrScanner" @scan="handleQrScan" @close="handleCloseScanner" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import QrScannerView from "../components/QrScannerView.vue";
import { t } from "../i18n";
import { ApiError, api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type TimeClockEvent = {
  id: string;
  type: string;
  timestamp: string;
};

type TodayResponse = {
  status: {
    currentType: string | null;
    nextType: string | null;
  };
  events: TimeClockEvent[];
};

const loading = ref(true);
const punching = ref(false);
const locating = ref(false);
const events = ref<TimeClockEvent[]>([]);
const status = ref<TodayResponse["status"]>({ currentType: null, nextType: "IN" });
const feedback = ref("");
const error = ref("");
const errorDetails = ref("");
const showQrFallback = ref(false);
const showQrScanner = ref(false);
const qrSubmitting = ref(false);
const qrFallbackError = ref("");

const statusLabel = computed(() => {
  if (!status.value.currentType) {
    return t("status.none");
  }
  if (status.value.currentType === "BREAK_START") {
    return t("status.break");
  }
  if (status.value.currentType === "OUT") {
    return t("status.off");
  }
  return t("status.working");
});

const nextLabel = computed(() => {
  return status.value.nextType ? formatType(status.value.nextType) : null;
});

const isClosed = computed(() => status.value.nextType === null);

const loadToday = async () => {
  loading.value = true;
  try {
    const data = await api.get<TodayResponse>("/timeclock/me/today");
    status.value = data.status;
    events.value = data.events;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

const handlePunch = async () => {
  error.value = "";
  errorDetails.value = "";
  feedback.value = "";
  qrFallbackError.value = "";
  locating.value = true;

  let geoPayload: { lat: number; lng: number; accuracy: number; capturedAt: string };
  try {
    geoPayload = await getGeoPayload();
  } catch (err) {
    locating.value = false;
    openQrFallback(resolveGeoError(err));
    return;
  }

  locating.value = false;
  punching.value = true;
  try {
    const response = await api.post<{ type: string; timestamp: string }>("/timeclock/punch", {
      geo: geoPayload,
    });
    const time = formatTime(response.timestamp);
    feedback.value = t("employee.home.feedback", { type: formatType(response.type), time });
    await loadToday();
  } catch (err) {
    if (err instanceof ApiError && err.code === "OUTSIDE_GEOFENCE") {
      error.value = getErrorMessage(err);
      const details = err.details as { distanceMeters?: number; radiusMeters?: number } | undefined;
      if (details?.distanceMeters !== undefined && details?.radiusMeters !== undefined) {
        errorDetails.value = t("employee.home.geoDistance", {
          distance: Math.round(details.distanceMeters),
          radius: Math.round(details.radiusMeters),
        });
      }
    } else if (shouldOfferQrFallback(err)) {
      openQrFallback();
    } else {
      error.value = getErrorMessage(err);
    }
  } finally {
    punching.value = false;
  }
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

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getGeoPayload = () =>
  new Promise<{ lat: number; lng: number; accuracy: number; capturedAt: string }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEO_UNAVAILABLE"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });

const resolveGeoError = (err: unknown) => {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: number }).code;
    if (code === 1) {
      return t("employee.home.geoDenied");
    }
  }
  return t("employee.home.geoUnavailable");
};

const shouldOfferQrFallback = (err: unknown) => {
  if (!(err instanceof ApiError)) {
    return false;
  }
  return ["GEO_REQUIRED", "LOW_ACCURACY", "GEO_FAILED_QR_REQUIRED"].includes(err.code || "");
};

const openQrFallback = (message?: string) => {
  qrFallbackError.value = message || "";
  showQrFallback.value = true;
};

const closeQrFallback = (_e?: Event) => {
  // Clique fora do modal (backdrop) só fecha se não estiver enviando
  if (qrSubmitting.value) return;

  showQrFallback.value = false;
  qrFallbackError.value = "";
};

// Use esta função quando você precisar fechar "na marra" pelo código
const forceCloseQrFallback = () => {
  showQrFallback.value = false;
  qrFallbackError.value = "";
};




const handleRetryGeo = async () => {
  closeQrFallback()
  await handlePunch();
};




const openQrScanner = () => {
  qrFallbackError.value = "";
  showQrFallback.value = false;
  showQrScanner.value = true;
};

const handleCloseScanner = () => {
  showQrScanner.value = false;
  showQrFallback.value = true;
};

const handleQrScan = async (token: string) => {
  showQrScanner.value = false;
  showQrFallback.value = true;
  qrSubmitting.value = true;
  qrFallbackError.value = "";

  try {
    const response = await api.post<{ type: string; timestamp: string }>("/timeclock/punch", {
      qr: { token },
    });
    const time = formatTime(response.timestamp);
    feedback.value = t("employee.home.feedback", { type: formatType(response.type), time });
    await loadToday();
    closeQrFallback();
  } catch (err) {
    qrFallbackError.value = getErrorMessage(err);
  } finally {
    qrSubmitting.value = false;
  }
};

onMounted(loadToday);
</script>
