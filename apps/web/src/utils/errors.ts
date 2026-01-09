import { ApiError } from "../services/api";
import { t } from "../i18n";

const MESSAGE_MAP: Record<string, string> = {
  "workday already closed": t("errors.workdayClosed"),
  unauthorized: t("errors.sessionExpired"),
  "invalid credentials": t("errors.invalidCredentials"),
  "email already exists": t("errors.emailExists"),
  "employee not found": t("errors.employeeNotFound"),
  "colaborador nao encontrado": t("errors.employeeNotFound"),
  "employee profile not found": t("errors.employeeProfileNotFound"),
  "invalid refresh token": t("errors.invalidRefreshToken"),
};

const CODE_MAP: Record<string, string> = {
  OUTSIDE_GEOFENCE: t("errors.geoOutside"),
  GEO_REQUIRED: t("errors.geoRequired"),
  LOW_ACCURACY: t("errors.geoLowAccuracy"),
  GEO_FAILED_QR_REQUIRED: t("errors.geoFailedQrRequired"),
  INVALID_QR: t("errors.invalidQr"),
  QR_DISABLED: t("errors.qrDisabled"),
  QR_EXPIRED: t("errors.qrExpired"),
  PIN_INVALID: t("errors.pinInvalid"),
  PIN_LOCKED: t("errors.pinLocked"),
  INVALID_EMPLOYEE_QR: t("errors.invalidEmployeeQr"),
};

const normalizeMessage = (message: string) =>
  message.trim().replace(/\.$/, "").toLowerCase();

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.code && CODE_MAP[error.code]) {
      return CODE_MAP[error.code];
    }
    const mapped = MESSAGE_MAP[normalizeMessage(error.message)];
    if (mapped) {
      return mapped;
    }
    if (error.status === 401) {
      return t("errors.sessionExpired");
    }
    if (error.status === 429) {
      return t("errors.tooManyRequests");
    }
    if (error.status === 400) {
      return t("errors.badRequest");
    }
    // Retorna mensagem detalhada com código e status
    if (error.status >= 500) {
      return `${error.message} (Erro ${error.status}${error.code ? ` - Código: ${error.code}` : ""})`;
    }
    return error.message || t("errors.unexpected");
  }

  if (error instanceof Error) {
    const mapped = MESSAGE_MAP[normalizeMessage(error.message)];
    if (mapped) {
      return mapped;
    }
    return error.message;
  }

  return t("errors.unexpected");
};

export const getErrorDetails = (error: unknown): { code?: string; status?: number; details?: unknown } => {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      status: error.status,
      details: error.details,
    };
  }
  return {};
};
