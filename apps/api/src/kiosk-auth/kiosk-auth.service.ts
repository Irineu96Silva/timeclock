import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { parseAndVerifyEmployeeQrToken } from "../utils/qr-signing";
import { KioskPinDto } from "./dto/kiosk-pin.dto";
import { KioskQrDto } from "./dto/kiosk-qr.dto";

type KioskAuthResult = {
  employeeId: string;
  fullName: string;
  user: { id: string; email: string };
  statusSuggestion: "ENTRADA" | "PAUSA" | "RETORNO" | "SAIDA";
  nextEventType: "IN" | "BREAK_START" | "BREAK_END" | "OUT";
};

type CompanySettingsSnapshot = {
  qrSecret: string;
};

type DeviceLockState = {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
};

const DEVICE_MAX_ATTEMPTS = 5;
const DEVICE_LOCK_SECONDS = 120;
const DEVICE_STATE_TTL_MS = 15 * 60 * 1000;

const deviceLockState = new Map<string, DeviceLockState>();

@Injectable()
export class KioskAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async authByPin(user: AuthenticatedUser, dto: KioskPinDto): Promise<KioskAuthResult> {
    const deviceLabel = dto.deviceLabel?.trim() || null;
    const deviceKey = this.getDeviceKey(user, deviceLabel);
    this.throwIfDeviceLocked(deviceKey);

    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        companyId: user.companyId!,
        isActive: true,
        pinHash: { not: null },
        user: { isActive: true },
      },
      select: {
        id: true,
        fullName: true,
        pinHash: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
        user: { select: { id: true, email: true } },
      },
    });

    let matched = null as (typeof employees)[number] | null;
    for (const employee of employees) {
      if (!employee.pinHash) {
        continue;
      }
      const matches = await bcrypt.compare(dto.pin, employee.pinHash);
      if (matches) {
        matched = employee;
        break;
      }
    }

    if (!matched) {
      const retryAfterSeconds = this.registerDeviceFailure(deviceKey);
      if (retryAfterSeconds) {
        await this.logAuthFailed(user, "PIN", "PIN_LOCKED", undefined, deviceLabel);
        throw new ForbiddenException({
          code: "PIN_LOCKED",
          message: `Muitas tentativas. Tente novamente em ${retryAfterSeconds}s.`,
          details: { retryAfterSeconds, scope: "DEVICE" },
        });
      }
      await this.logAuthFailed(user, "PIN", "PIN_INVALID", undefined, deviceLabel);
      throw new ForbiddenException({
        code: "PIN_INVALID",
        message: "PIN incorreto.",
      });
    }

    if (matched.pinLockedUntil && matched.pinLockedUntil > new Date()) {
      const retryAfterSeconds = this.getRetryAfterSeconds(matched.pinLockedUntil);
      this.registerDeviceFailure(deviceKey);
      await this.logAuthFailed(user, "PIN", "PIN_LOCKED", matched.id, deviceLabel);
      throw new ForbiddenException({
        code: "PIN_LOCKED",
        message: `Muitas tentativas. Tente novamente em ${retryAfterSeconds}s.`,
        details: { retryAfterSeconds, scope: "EMPLOYEE" },
      });
    }

    await this.prisma.employeeProfile.update({
      where: { id: matched.id },
      data: {
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    this.resetDeviceState(deviceKey);

    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId!,
        userId: user.id,
        action: "KIOSK_AUTH_SUCCESS",
        entity: "EmployeeProfile",
        entityId: matched.id,
        payloadJson: JSON.stringify({
          method: "PIN",
          deviceLabel,
          employeeId: matched.id,
        }),
      },
    });

    const suggestion = await this.getSuggestion(user.companyId!, matched.id);
    return {
      employeeId: matched.id,
      fullName: matched.fullName,
      user: matched.user,
      ...suggestion,
    };
  }

  async authByQr(user: AuthenticatedUser, dto: KioskQrDto): Promise<KioskAuthResult> {
    const deviceLabel = dto.deviceLabel?.trim() || null;
    const token = dto.token?.trim();
    if (!token) {
      await this.logAuthFailed(user, "EMPLOYEE_QR", "INVALID_EMPLOYEE_QR", undefined, deviceLabel);
      throw new ForbiddenException({
        code: "INVALID_EMPLOYEE_QR",
        message: "QR do colaborador invalido.",
      });
    }

    const settings = await this.getCompanySettings(user.companyId!);

    let parsed: { companyId: string; employeeId: string };
    try {
      parsed = parseAndVerifyEmployeeQrToken(token, settings.qrSecret);
    } catch {
      await this.logAuthFailed(user, "EMPLOYEE_QR", "INVALID_EMPLOYEE_QR", undefined, deviceLabel);
      throw new ForbiddenException({
        code: "INVALID_EMPLOYEE_QR",
        message: "QR do colaborador invalido.",
      });
    }

    if (parsed.companyId !== user.companyId!) {
      await this.logAuthFailed(user, "EMPLOYEE_QR", "INVALID_EMPLOYEE_QR", undefined, deviceLabel);
      throw new ForbiddenException({
        code: "INVALID_EMPLOYEE_QR",
        message: "QR do colaborador invalido.",
      });
    }

    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: parsed.employeeId,
        companyId: user.companyId!,
        isActive: true,
        user: { isActive: true },
      },
      include: { user: true },
    });

    if (!employee) {
      await this.logAuthFailed(
        user,
        "EMPLOYEE_QR",
        "EMPLOYEE_NOT_FOUND",
        parsed.employeeId,
        deviceLabel,
      );
      throw new NotFoundException("Colaborador nao encontrado");
    }

    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId!,
        userId: user.id,
        action: "KIOSK_AUTH_SUCCESS",
        entity: "EmployeeProfile",
        entityId: employee.id,
        payloadJson: JSON.stringify({
          method: "EMPLOYEE_QR",
          deviceLabel,
          employeeId: employee.id,
        }),
      },
    });

    const suggestion = await this.getSuggestion(user.companyId!, employee.id);
    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      user: { id: employee.userId, email: employee.user.email },
      ...suggestion,
    };
  }

  private async logAuthFailed(
    user: AuthenticatedUser,
    method: "PIN" | "EMPLOYEE_QR",
    reason: string,
    employeeId?: string,
    deviceLabel?: string | null,
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId!,
        userId: user.id,
        action: "KIOSK_AUTH_FAILED",
        entity: "EmployeeProfile",
        entityId: employeeId,
        payloadJson: JSON.stringify({
          method,
          reason,
          deviceLabel: deviceLabel ?? null,
          employeeId: employeeId ?? null,
        }),
      },
    });
  }

  private getDeviceKey(user: AuthenticatedUser, deviceLabel?: string | null) {
    const label = deviceLabel?.trim();
    return `${user.companyId!}:${user.id}:${label || "UNKNOWN"}`;
  }

  private getDeviceState(key: string) {
    const now = Date.now();
    const existing = deviceLockState.get(key);
    if (existing && now - existing.lastAttemptAt > DEVICE_STATE_TTL_MS) {
      deviceLockState.delete(key);
    }
    if (!deviceLockState.has(key)) {
      const fresh: DeviceLockState = {
        failedAttempts: 0,
        lockedUntil: null,
        lastAttemptAt: now,
      };
      deviceLockState.set(key, fresh);
      return fresh;
    }
    return deviceLockState.get(key)!;
  }

  private throwIfDeviceLocked(key: string) {
    const state = this.getDeviceState(key);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.lockedUntil - Date.now()) / 1000),
      );
      throw new ForbiddenException({
        code: "PIN_LOCKED",
        message: `Muitas tentativas. Tente novamente em ${retryAfterSeconds}s.`,
        details: { retryAfterSeconds, scope: "DEVICE" },
      });
    }
  }

  private registerDeviceFailure(key: string) {
    const state = this.getDeviceState(key);
    state.failedAttempts += 1;
    state.lastAttemptAt = Date.now();
    if (state.failedAttempts >= DEVICE_MAX_ATTEMPTS) {
      state.failedAttempts = 0;
      state.lockedUntil = Date.now() + DEVICE_LOCK_SECONDS * 1000;
      return Math.max(1, Math.ceil(DEVICE_LOCK_SECONDS));
    }
    return null;
  }

  private resetDeviceState(key: string) {
    deviceLockState.delete(key);
  }

  private getRetryAfterSeconds(lockedUntil: Date) {
    return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  }

  private async getSuggestion(companyId: string, employeeId: string) {
    const { start, end } = this.getDayRange();
    const lastEvent = await this.prisma.timeClockEvent.findFirst({
      where: {
        companyId,
        employeeId,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: "desc" },
      select: { type: true },
    });

    const nextEventType = this.getNextEventType(lastEvent?.type ?? null);
    const statusSuggestion = this.getStatusSuggestion(nextEventType);

    return { nextEventType, statusSuggestion };
  }

  private getNextEventType(lastType: string | null): "IN" | "BREAK_START" | "BREAK_END" | "OUT" {
    if (!lastType || lastType === "OUT") {
      return "IN";
    }
    if (lastType === "IN") {
      return "BREAK_START";
    }
    if (lastType === "BREAK_START") {
      return "BREAK_END";
    }
    return "OUT";
  }

  private getStatusSuggestion(
    nextEventType: "IN" | "BREAK_START" | "BREAK_END" | "OUT",
  ): "ENTRADA" | "PAUSA" | "RETORNO" | "SAIDA" {
    switch (nextEventType) {
      case "IN":
        return "ENTRADA";
      case "BREAK_START":
        return "PAUSA";
      case "BREAK_END":
        return "RETORNO";
      case "OUT":
      default:
        return "SAIDA";
    }
  }

  private getDayRange(reference = new Date()) {
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    const end = new Date(reference);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private async getCompanySettings(companyId: string): Promise<CompanySettingsSnapshot> {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: { qrSecret: true },
    });

    if (settings) {
      if (!settings.qrSecret || settings.qrSecret.trim() === "") {
        return this.prisma.companySettings.update({
          where: { companyId },
          data: { qrSecret: this.generateQrSecret() },
          select: { qrSecret: true },
        });
      }
      return settings;
    }

    const created = await this.prisma.companySettings.create({
      data: {
        companyId,
        geofenceEnabled: true,
        geoRequired: true,
        geofenceLat: 0,
        geofenceLng: 0,
        geofenceRadiusMeters: 200,
        maxAccuracyMeters: 100,
        qrEnabled: true,
        punchFallbackMode: "GEO_OR_QR",
        qrSecret: this.generateQrSecret(),
        kioskDeviceLabel: "",
      },
      select: { qrSecret: true },
    });

    return created;
  }

  private generateQrSecret() {
    return randomBytes(32).toString("hex");
  }
}
