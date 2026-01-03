<template>
  <section class="kiosk-page">
    <div class="card kiosk-card">
      <div class="card-header">
        <h2 class="card-title">{{ t("kiosk.title") }}</h2>
        <p class="card-subtitle">{{ t("kiosk.subtitle") }}</p>
      </div>

      <div v-if="loading" class="muted">{{ t("kiosk.loading") }}</div>
      <div v-else class="kiosk-body">
        <canvas ref="canvasRef" class="kiosk-qr"></canvas>
        <div class="kiosk-meta">
          <span class="badge badge--info">{{ kioskData?.date }}</span>
          <p class="muted">{{ t("kiosk.hint") }}</p>
        </div>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import QRCode from "qrcode";
import { t } from "../i18n";
import { api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type KioskQrResponse = {
  date: string;
  qrToken: string;
  expiresAt: string;
  deviceLabel?: string;
};

const loading = ref(true);
const error = ref("");
const kioskData = ref<KioskQrResponse | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
let refreshTimer: number | undefined;

const renderQr = async () => {
  if (!canvasRef.value || !kioskData.value) {
    return;
  }
  try {
    await QRCode.toCanvas(canvasRef.value, kioskData.value.qrToken, {
      width: 320,
      margin: 1,
    });
  } catch {
    error.value = t("kiosk.qrError");
  }
};

const loadQr = async () => {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.get<KioskQrResponse>("/kiosk/qr/today");
    kioskData.value = data;
    await renderQr();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadQr();
  refreshTimer = window.setInterval(loadQr, 5 * 60 * 1000);
});

onUnmounted(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});
</script>
