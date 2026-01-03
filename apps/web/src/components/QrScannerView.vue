<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal qr-modal">
      <div class="modal-header">
        <h3>{{ titleText }}</h3>
        <p class="muted">{{ subtitleText }}</p>
      </div>
      <div class="qr-scanner">
        <video ref="videoRef" class="qr-video" muted playsinline></video>
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="emit('close')">
          {{ closeText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import QrScanner from "qr-scanner";
import { t } from "../i18n";

(QrScanner as unknown as { WORKER_PATH: string }).WORKER_PATH = new URL(
  "qr-scanner/qr-scanner-worker.min.js",
  import.meta.url,
).toString();

const emit = defineEmits<{
  (event: "scan", token: string): void;
  (event: "close"): void;
}>();

const props = defineProps<{
  title?: string;
  subtitle?: string;
  closeLabel?: string;
  errorLabel?: string;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const error = ref("");
let scanner: QrScanner | null = null;
let hasResult = false;

const titleText = computed(() => props.title ?? t("employee.qrScanner.title"));
const subtitleText = computed(() => props.subtitle ?? t("employee.qrScanner.subtitle"));
const closeText = computed(() => props.closeLabel ?? t("employee.qrScanner.close"));
const errorText = computed(() => props.errorLabel ?? t("employee.qrScanner.error"));

const handleScan = (result: string | { data: string }) => {
  const value = typeof result === "string" ? result : result?.data;
  if (!value || hasResult) {
    return;
  }
  hasResult = true;
  emit("scan", value);
};

onMounted(async () => {
  if (!videoRef.value) {
    error.value = errorText.value;
    return;
  }

  scanner = new QrScanner(videoRef.value, handleScan, {
    preferredCamera: "environment",
  } as any);

  try {
    await scanner.start();
  } catch {
    error.value = errorText.value;
  }
});

onUnmounted(() => {
  if (scanner) {
    scanner.stop();
    scanner.destroy();
  }
});
</script>
