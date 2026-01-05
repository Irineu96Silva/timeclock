<template>
  <section ref="screenRef" class="kiosk-screen">
    <video ref="videoRef" class="kiosk-camera" autoplay muted playsinline></video>

    <div v-if="deviceLabel" class="kiosk-device">
      <span class="kiosk-device__label">{{ t("kiosk.terminal.deviceLabel") }}</span>
      <strong>{{ deviceLabel }}</strong>
    </div>

    <div class="kiosk-toolbar">
      <button
        class="btn btn-ghost btn-sm"
        type="button"
        :disabled="isFullscreen"
        @click="requestFullscreen"
      >
        {{ t("kiosk.terminal.fullscreen") }}
      </button>
      <span class="kiosk-toolbar__hint">{{ fullscreenHint }}</span>
      <span v-if="wakeLockWarning" class="kiosk-toolbar__warn">{{ wakeLockWarning }}</span>
    </div>

    <div v-if="mode === 'idle'" class="kiosk-idle" :style="idleShiftStyle">
      <h2>{{ t("kiosk.terminal.idleTitle") }}</h2>
      <p class="muted">{{ t("kiosk.terminal.idleSubtitle") }}</p>
      <p v-if="faceError" class="muted">{{ faceError }}</p>
    </div>

    <div v-else class="kiosk-panel">
      <h3>{{ t("kiosk.terminal.title") }}</h3>
      <p class="muted">{{ t("kiosk.terminal.subtitle") }}</p>

      <div v-if="mode === 'auth'">
        <div class="kiosk-pin-display">
          <div v-for="(digit, index) in pinSlots" :key="index" class="kiosk-pin-digit">
            {{ digit }}
          </div>
        </div>

        <div class="kiosk-keypad">
          <button
            v-for="digit in keypadDigits"
            :key="digit"
            class="kiosk-key"
            type="button"
            :disabled="authLoading"
            @click="handleDigit(digit)"
          >
            {{ digit }}
          </button>
          <button
            class="kiosk-key kiosk-key--action"
            type="button"
            :disabled="authLoading"
            @click="handleClear"
          >
            {{ t("kiosk.terminal.clear") }}
          </button>
          <button
            class="kiosk-key"
            type="button"
            :disabled="authLoading"
            @click="handleDigit('0')"
          >
            0
          </button>
          <button
            class="kiosk-key kiosk-key--action"
            type="button"
            :disabled="authLoading"
            @click="handleBackspace"
          >
            {{ t("kiosk.terminal.backspace") }}
          </button>
        </div>

        <div class="kiosk-actions">
          <button
            class="btn btn-ghost"
            type="button"
            :disabled="authLoading"
            @click="openQrScanner"
          >
            {{ t("kiosk.terminal.scanQr") }}
          </button>
          <button class="btn btn-ghost" type="button" :disabled="authLoading" @click="resetToIdle">
            {{ t("kiosk.terminal.cancel") }}
          </button>
        </div>

        <p v-if="authLoading" class="muted">{{ t("kiosk.terminal.authLoading") }}</p>
        <p v-if="faceError" class="muted">{{ faceError }}</p>
        <div v-if="authError" class="kiosk-feedback kiosk-feedback--error">
          {{ authError }}
        </div>
      </div>

      <div v-else-if="mode === 'confirm'">
        <div class="kiosk-info">
          <span class="muted">{{ t("kiosk.terminal.employeeLabel") }}</span>
          <strong>{{ authResult?.fullName }}</strong>
          <p class="muted">ID: {{ authResult?.employeeId }}</p>
        </div>

        <div class="kiosk-info">
          <span class="muted">{{ t("kiosk.terminal.actionLabel") }}</span>
          <strong>{{ suggestionLabel }}</strong>
        </div>

        <div class="kiosk-actions">
          <button class="btn btn-primary" type="button" :disabled="punchLoading" @click="handleConfirm">
            {{ punchLoading ? t("kiosk.terminal.confirming") : t("kiosk.terminal.confirm") }}
          </button>
          <button class="btn btn-ghost" type="button" :disabled="punchLoading" @click="resetToIdle">
            {{ t("kiosk.terminal.cancel") }}
          </button>
        </div>

        <div v-if="punchError" class="kiosk-feedback kiosk-feedback--error">
          {{ punchError }}
        </div>
      </div>

      <div v-else-if="mode === 'result'">
        <div class="kiosk-feedback kiosk-feedback--success">{{ successMessage }}</div>
        <p class="muted">{{ t("kiosk.terminal.resetHint") }}</p>
      </div>
    </div>

    <QrScannerView
      v-if="showQrScanner"
      :title="t('kiosk.terminal.qrTitle')"
      :subtitle="t('kiosk.terminal.qrSubtitle')"
      :close-label="t('kiosk.terminal.qrClose')"
      :error-label="t('kiosk.terminal.qrError')"
      @scan="handleQrScan"
      @close="closeQrScanner"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Camera } from "@mediapipe/camera_utils";
import { FaceDetection } from "@mediapipe/face_detection";
import QrScannerView from "../components/QrScannerView.vue";
import { t } from "../i18n";
import { ApiError, api } from "../services/api";
import { getErrorMessage } from "../utils/errors";

type KioskAuthResponse = {
  employeeId: string;
  fullName: string;
  user: { id: string; email: string };
  statusSuggestion: "ENTRADA" | "PAUSA" | "RETORNO" | "SAIDA";
  nextEventType: "IN" | "BREAK_START" | "BREAK_END" | "OUT";
};

type KioskPunchResponse = {
  eventType: "IN" | "BREAK_START" | "BREAK_END" | "OUT";
  timestamp: string;
  employee: { id: string; fullName: string };
  statusNow: "TRABALHANDO" | "EM_PAUSA" | "FORA";
};

type KioskDeviceResponse = {
  deviceLabel?: string;
};

type KioskMode = "idle" | "auth" | "confirm" | "result";
type AuthMethod = "PIN" | "EMPLOYEE_QR";
type WakeLockSentinel = { released: boolean; release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLockSentinel> };

const mode = ref<KioskMode>("idle");
const screenRef = ref<HTMLElement | null>(null);
const pinValue = ref("");
const deviceLabel = ref("");
const authResult = ref<KioskAuthResponse | null>(null);
const authMethod = ref<AuthMethod | null>(null);
const authLoading = ref(false);
const authError = ref("");
const punchLoading = ref(false);
const punchError = ref("");
const punchResult = ref<KioskPunchResponse | null>(null);
const showQrScanner = ref(false);
const faceError = ref("");
const videoRef = ref<HTMLVideoElement | null>(null);
const isFullscreen = ref(false);
const wakeLockWarning = ref("");
const idleShift = ref({ x: 0, y: 0 });

const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const pinSlots = computed(() => {
  const slots: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    slots.push(pinValue.value[i] ? "*" : "");
  }
  return slots;
});

const suggestionLabel = computed(() => {
  if (!authResult.value) {
    return "";
  }
  switch (authResult.value.statusSuggestion) {
    case "ENTRADA":
      return t("kiosk.terminal.suggestions.entry");
    case "PAUSA":
      return t("kiosk.terminal.suggestions.break");
    case "RETORNO":
      return t("kiosk.terminal.suggestions.return");
    case "SAIDA":
    default:
      return t("kiosk.terminal.suggestions.out");
  }
});

const successMessage = computed(() => {
  if (!punchResult.value) {
    return "";
  }
  return t("kiosk.terminal.success", {
    type: formatEventType(punchResult.value.eventType),
    time: formatTime(punchResult.value.timestamp),
  });
});

const idleShiftStyle = computed(() => {
  if (mode.value !== "idle") {
    return {};
  }
  return {
    transform: `translate(${idleShift.value.x}px, ${idleShift.value.y}px)`,
  };
});

const fullscreenHint = computed(() =>
  isFullscreen.value ? t("kiosk.terminal.fullscreenActive") : t("kiosk.terminal.fullscreenHint"),
);

let camera: Camera | null = null;
let detector: FaceDetection | null = null;
let presenceTimer: number | null = null;
let resetTimer: number | null = null;
let burnInTimer: number | null = null;
let lastPresenceAt = 0;
let wakeLock: WakeLockSentinel | null = null;

const formatEventType = (type: string) => {
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

const clearResetTimer = () => {
  if (resetTimer) {
    window.clearTimeout(resetTimer);
    resetTimer = null;
  }
};

const scheduleReset = (ms = 10000) => {
  clearResetTimer();
  resetTimer = window.setTimeout(() => {
    resetToIdle();
  }, ms);
};

const resetState = () => {
  pinValue.value = "";
  authResult.value = null;
  authMethod.value = null;
  authError.value = "";
  authLoading.value = false;
  punchError.value = "";
  punchResult.value = null;
  punchLoading.value = false;
};

const enterAuth = () => {
  clearResetTimer();
  resetState();
  lastPresenceAt = Date.now();
  mode.value = "auth";
};

const resetToIdle = () => {
  clearResetTimer();
  resetState();
  showQrScanner.value = false;
  mode.value = "idle";
};

const markPresence = () => {
  lastPresenceAt = Date.now();
  if (mode.value === "idle") {
    enterAuth();
  }
};

const requestWakeLock = async () => {
  const apiWakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
  if (!apiWakeLock) {
    wakeLockWarning.value = t("kiosk.terminal.wakeLockWarning");
    return;
  }
  try {
    wakeLock = await apiWakeLock.request("screen");
    wakeLockWarning.value = "";
  } catch {
    wakeLockWarning.value = t("kiosk.terminal.wakeLockWarning");
  }
};

const releaseWakeLock = async () => {
  if (!wakeLock) {
    return;
  }
  try {
    await wakeLock.release();
  } catch {
    // ignore release failures
  } finally {
    wakeLock = null;
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    void requestWakeLock();
  }
};

const updateFullscreenState = () => {
  isFullscreen.value = Boolean(document.fullscreenElement);
};

const requestFullscreen = async () => {
  if (!screenRef.value || isFullscreen.value) {
    return;
  }
  try {
    await screenRef.value.requestFullscreen();
  } catch {
    // ignore fullscreen errors
  }
};

const resolveAuthError = (err: unknown) => {
  if (err instanceof ApiError && err.code === "PIN_LOCKED") {
    const details = err.details as { retryAfterSeconds?: number } | undefined;
    if (details?.retryAfterSeconds) {
      return t("kiosk.terminal.pinRetry", { seconds: details.retryAfterSeconds });
    }
  }
  return getErrorMessage(err);
};

const loadDeviceLabel = async () => {
  try {
    const response = await api.get<KioskDeviceResponse>("/kiosk/qr/today");
    deviceLabel.value = response.deviceLabel?.trim() || "";
  } catch {
    deviceLabel.value = "";
  }
};

const submitPin = async () => {
  if (pinValue.value.length !== 4 || authLoading.value) {
    return;
  }
  authLoading.value = true;
  authError.value = "";
  try {
    const response = await api.post<KioskAuthResponse>("/kiosk/auth/pin", {
      pin: pinValue.value,
      deviceLabel: deviceLabel.value || undefined,
    });
    authResult.value = response;
    authMethod.value = "PIN";
    mode.value = "confirm";
  } catch (err) {
    authError.value = resolveAuthError(err);
    pinValue.value = "";
  } finally {
    authLoading.value = false;
  }
};

const handleDigit = (digit: string) => {
  if (authLoading.value || mode.value !== "auth") {
    return;
  }
  markPresence();
  if (pinValue.value.length >= 4) {
    return;
  }
  pinValue.value += digit;
  if (pinValue.value.length === 4) {
    void submitPin();
  }
};

const handleBackspace = () => {
  if (authLoading.value || mode.value !== "auth") {
    return;
  }
  markPresence();
  pinValue.value = pinValue.value.slice(0, -1);
};

const handleClear = () => {
  if (authLoading.value || mode.value !== "auth") {
    return;
  }
  markPresence();
  pinValue.value = "";
};

const openQrScanner = () => {
  if (authLoading.value) {
    return;
  }
  markPresence();
  authError.value = "";
  showQrScanner.value = true;
};

const closeQrScanner = () => {
  showQrScanner.value = false;
};

const handleQrScan = async (token: string) => {
  showQrScanner.value = false;
  authLoading.value = true;
  authError.value = "";
  try {
    const response = await api.post<KioskAuthResponse>("/kiosk/auth/qr", {
      token,
      deviceLabel: deviceLabel.value || undefined,
    });
    authResult.value = response;
    authMethod.value = "EMPLOYEE_QR";
    mode.value = "confirm";
  } catch (err) {
    authError.value = getErrorMessage(err);
  } finally {
    authLoading.value = false;
  }
};

const handleConfirm = async () => {
  if (!authResult.value || !authMethod.value || punchLoading.value) {
    return;
  }
  clearResetTimer();
  punchLoading.value = true;
  punchError.value = "";
  try {
    const response = await api.post<KioskPunchResponse>("/kiosk/punch", {
      employeeId: authResult.value.employeeId,
      method: authMethod.value,
      deviceLabel: deviceLabel.value || undefined,
    });
    punchResult.value = response;
    mode.value = "result";
    scheduleReset();
  } catch (err) {
    punchError.value = getErrorMessage(err);
  } finally {
    punchLoading.value = false;
  }
};

const startPresenceTimer = () => {
  if (presenceTimer) {
    return;
  }
  presenceTimer = window.setInterval(() => {
    if (
      mode.value === "idle" ||
      authLoading.value ||
      punchLoading.value ||
      showQrScanner.value
    ) {
      return;
    }
    if (lastPresenceAt && Date.now() - lastPresenceAt > 15000) {
      resetToIdle();
    }
  }, 1000);
};

const startFaceDetection = async () => {
  startPresenceTimer();
  if (!videoRef.value) {
    faceError.value = t("kiosk.terminal.cameraError");
    enterAuth();
    return;
  }

  try {
    detector = new FaceDetection({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
});
detector.setOptions({ model: "short", minDetectionConfidence: 0.5 });
detector.onResults((results) => {
  if (results.detections && results.detections.length > 0) {
    markPresence();
  }
});

    camera = new Camera(videoRef.value, {
      onFrame: async () => {
        if (detector && videoRef.value) {
          await detector.send({ image: videoRef.value });
        }
      },
      width: 640,
      height: 480,
    });

    await camera.start();
  } catch {
    faceError.value = t("kiosk.terminal.cameraError");
    enterAuth();
  }
};

const startBurnInShift = () => {
  burnInTimer = window.setInterval(() => {
    if (mode.value !== "idle") {
      return;
    }
    const range = 6;
    idleShift.value = {
      x: Math.floor(Math.random() * (range * 2 + 1)) - range,
      y: Math.floor(Math.random() * (range * 2 + 1)) - range,
    };
  }, 30000);
};

onMounted(() => {
  void startFaceDetection();
  void loadDeviceLabel();
  void requestWakeLock();
  startBurnInShift();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);
  document.addEventListener("fullscreenchange", updateFullscreenState);
  updateFullscreenState();
});

onUnmounted(() => {
  clearResetTimer();
  if (burnInTimer) {
    window.clearInterval(burnInTimer);
  }
  if (presenceTimer) {
    window.clearInterval(presenceTimer);
  }
  if (camera) {
    camera.stop();
  }
  if (detector) {
    detector.close();
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleVisibilityChange);
  document.removeEventListener("fullscreenchange", updateFullscreenState);
  void releaseWakeLock();
});

watch(mode, (value) => {
  if (value !== "idle") {
    idleShift.value = { x: 0, y: 0 };
  }
});
</script>
