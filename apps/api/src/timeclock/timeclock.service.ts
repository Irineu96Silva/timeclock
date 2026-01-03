import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { PunchDto } from "./dto/punch.dto";
import { HistoryQueryDto } from "./dto/history-query.dto";
import { parseAndVerifyQrToken } from "../utils/qr-signing";

const VALID_TYPES = ["IN", "BREAK_START", "BREAK_END", "OUT"] as const;
type TimeClockType = (typeof VALID_TYPES)[number];

const NEXT_TYPE_MAP: Record<Exclude<TimeClockType, "OUT">, TimeClockType> = {
  IN: "BREAK_START",
  BREAK_START: "BREAK_END",
  BREAK_END: "OUT",
};

const GEO_BLOCK_MESSAGES = {
  OUTSIDE_GEOFENCE:
    "Voce esta fora da area da empresa. Para registrar o ponto, esteja no local.",
  GEO_REQUIRED: "Localizacao obrigatoria para registrar o ponto.",
  LOW_ACCURACY:
    "Nao foi possivel confirmar sua localizacao com precisao. Ative o GPS e tente novamente.",
} as const;

const QR_BLOCK_MESSAGES = {
  GEO_FAILED_QR_REQUIRED:
    "Nao foi possivel obter sua localizacao. Para registrar o ponto, leia o QR Code da empresa.",
  INVALID_QR: "QR invalido. Leia o QR Code da empresa novamente.",
  QR_DISABLED: "Registro por QR Code esta desabilitado para esta empresa.",
  QR_EXPIRED: "QR expirado. Leia o QR Code de hoje.",
} as const;

type GeoBlockCode = keyof typeof GEO_BLOCK_MESSAGES;
type QrBlockCode = keyof typeof QR_BLOCK_MESSAGES;

type PunchMethod = "GEO" | "QR";
type PunchFallbackMode = "GEO_ONLY" | "GEO_OR_QR" | "QR_ONLY";

type GeoInput = {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: Date;
};

type CompanySettingsSnapshot = {
  geofenceEnabled: boolean;
  geoRequired: boolean;
  geofenceLat: number;
  geofenceLng: number;
  geofenceRadiusMeters: number;
  maxAccuracyMeters: number;
  qrEnabled: boolean;
  punchFallbackMode: string;
  qrSecret: string;
};

type GeoDecision =
  | {
      blocked: false;
      geo: GeoInput | null;
      geoStatus: "OK" | "MISSING";
      geoDistanceMeters: number | null;
    }
  | {
      blocked: true;
      code: GeoBlockCode;
      message: string;
      geo: GeoInput | null;
      geoStatus: "OUTSIDE" | "LOW_ACCURACY" | "MISSING";
      geoDistanceMeters: number | null;
      details?: Record<string, number>;
    };

type PunchResolution = {
  method: PunchMethod;
  geoDecision: GeoDecision;
  qrDate: string | null;
};

@Injectable()
export class TimeClockService {
  constructor(private readonly prisma: PrismaService) {}

  async punch(
    user: AuthenticatedUser,
    dto: PunchDto,
    metadata?: { ip?: string; userAgent?: string },
  ) {
    const employee = await this.getEmployeeProfile(user);
    const settings = await this.getCompanySettings(user.companyId);
    const geoInput = dto.geo
      ? {
          lat: dto.geo.lat,
          lng: dto.geo.lng,
          accuracy: dto.geo.accuracy,
          capturedAt: new Date(dto.geo.capturedAt),
        }
      : null;
    const qrToken = dto.qr?.token?.trim() || null;

    const resolution = await this.resolvePunch(user, settings, geoInput, qrToken, metadata);

    const { start, end } = this.getDayRange();

    const lastEvent = await this.prisma.timeClockEvent.findFirst({
      where: {
        companyId: user.companyId,
        employeeId: employee.id,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: "desc" },
    });

    const nextType = this.getNextType(lastEvent?.type ?? null);
    const timestamp = new Date();

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.timeClockEvent.create({
        data: {
          companyId: user.companyId,
          employeeId: employee.id,
          type: nextType,
          timestamp,
          source: "PWA",
          deviceId: dto.deviceId?.trim() || null,
          ip: metadata?.ip,
          userAgent: metadata?.userAgent,
          latitude: resolution.geoDecision.geo?.lat ?? null,
          longitude: resolution.geoDecision.geo?.lng ?? null,
          accuracy: resolution.geoDecision.geo?.accuracy ?? null,
          geoCapturedAt: resolution.geoDecision.geo?.capturedAt ?? null,
          geoDistanceMeters: resolution.geoDecision.geoDistanceMeters,
          geoStatus: resolution.geoDecision.geoStatus,
          punchMethod: resolution.method,
          qrDate: resolution.qrDate,
          qrNonce: null,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: "TIMECLOCK_PUNCH",
          entity: "TimeClockEvent",
          entityId: created.id,
          payloadJson: JSON.stringify({
            method: resolution.method,
            geoStatus: resolution.geoDecision.geoStatus,
            qrDate: resolution.qrDate,
          }),
        },
      });

      return created;
    });

    return { type: event.type, timestamp: event.timestamp };
  }

  async getToday(user: AuthenticatedUser) {
    const employee = await this.getEmployeeProfile(user);
    const { start, end } = this.getDayRange();

    const events = await this.prisma.timeClockEvent.findMany({
      where: {
        companyId: user.companyId,
        employeeId: employee.id,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        type: true,
        timestamp: true,
      },
    });

    const lastEvent = events[events.length - 1];
    const status = this.getStatus(lastEvent?.type ?? null);

    return { status, events };
  }

  async getHistory(user: AuthenticatedUser, query: HistoryQueryDto) {
    const employee = await this.getEmployeeProfile(user);
    const from = query.from;
    const to = query.to;

    if (from > to) {
      throw new BadRequestException("from must be before to");
    }

    return this.prisma.timeClockEvent.findMany({
      where: {
        companyId: user.companyId,
        employeeId: employee.id,
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        type: true,
        timestamp: true,
      },
    });
  }

  private async resolvePunch(
    user: AuthenticatedUser,
    settings: CompanySettingsSnapshot,
    geoInput: GeoInput | null,
    qrToken: string | null,
    metadata?: { ip?: string; userAgent?: string },
  ): Promise<PunchResolution> {
    const fallbackMode = this.normalizeFallbackMode(settings.punchFallbackMode);
    const emptyGeoDecision = this.buildEmptyGeoDecision();
    const today = this.formatDate(new Date());

    // 1) QR_ONLY: exige QR e qrEnabled
    if (fallbackMode === "QR_ONLY") {
      if (!settings.qrEnabled) {
        await this.throwBlockedAttempt(user, metadata, {
          code: "QR_DISABLED",
          message: QR_BLOCK_MESSAGES.QR_DISABLED,
          methodAttempted: "QR",
        });
      }

      const qrDate = await this.validateQrToken(user, settings, qrToken, today, metadata);
      return { method: "QR", geoDecision: emptyGeoDecision, qrDate };
    }

    // 2) Tentativa por GEO
    const geoDecision = this.evaluateGeo(settings, geoInput);
    if (!geoDecision.blocked) {
      return { method: "GEO", geoDecision, qrDate: null };
    }

    // 3) GEO_ONLY: bloqueia no primeiro erro de GEO
    if (fallbackMode === "GEO_ONLY") {
      await this.throwBlockedAttempt(user, metadata, {
        code: geoDecision.code,
        message: geoDecision.message,
        details: geoDecision.details ?? null,
        methodAttempted: "GEO",
        geoDecision,
        accuracy: geoInput?.accuracy ?? null,
      });
    }

    // 4) GEO_OR_QR: fora do geofence continua bloqueando
    if (geoDecision.code === "OUTSIDE_GEOFENCE") {
      await this.throwBlockedAttempt(user, metadata, {
        code: geoDecision.code,
        message: geoDecision.message,
        details: geoDecision.details ?? null,
        methodAttempted: "GEO",
        geoDecision,
        accuracy: geoInput?.accuracy ?? null,
      });
    }

    if (!settings.qrEnabled) {
      await this.throwBlockedAttempt(user, metadata, {
        code: "QR_DISABLED",
        message: QR_BLOCK_MESSAGES.QR_DISABLED,
        methodAttempted: "QR",
      });
    }

    if (qrToken) {
      const qrDate = await this.validateQrToken(user, settings, qrToken, today, metadata);
      return { method: "QR", geoDecision: emptyGeoDecision, qrDate };
    }

    await this.throwBlockedAttempt(user, metadata, {
      code: "GEO_FAILED_QR_REQUIRED",
      message: QR_BLOCK_MESSAGES.GEO_FAILED_QR_REQUIRED,
      methodAttempted: "GEO",
      geoDecision,
      accuracy: geoInput?.accuracy ?? null,
    });

    // Se chegou aqui, algo esta errado, porque throwBlockedAttempt lanca (never)
    throw new Error("Fluxo invalido: throwBlockedAttempt nao interrompeu a execucao.");
  }

  private async validateQrToken(
    user: AuthenticatedUser,
    settings: CompanySettingsSnapshot,
    qrToken: string | null,
    expectedDate: string,
    metadata?: { ip?: string; userAgent?: string },
  ): Promise<string> {
    if (!qrToken) {
      await this.throwBlockedAttempt(user, metadata, {
        code: "INVALID_QR",
        message: QR_BLOCK_MESSAGES.INVALID_QR,
        methodAttempted: "QR",
      });
      // Seguranca extra para o TS (embora throwBlockedAttempt seja never)
      throw new Error("INVALID_QR: token ausente.");
    }

    if (!settings.qrSecret) {
      await this.throwBlockedAttempt(user, metadata, {
        code: "INVALID_QR",
        message: QR_BLOCK_MESSAGES.INVALID_QR,
        methodAttempted: "QR",
      });
      throw new Error("INVALID_QR: qrSecret ausente.");
    }

    let parsed: { companyId: string; date: string };
    try {
      parsed = parseAndVerifyQrToken(qrToken, settings.qrSecret);
    } catch {
      await this.throwBlockedAttempt(user, metadata, {
        code: "INVALID_QR",
        message: QR_BLOCK_MESSAGES.INVALID_QR,
        methodAttempted: "QR",
      });
      throw new Error("INVALID_QR: parse falhou.");
    }

    if (parsed.companyId !== user.companyId) {
      await this.throwBlockedAttempt(user, metadata, {
        code: "INVALID_QR",
        message: QR_BLOCK_MESSAGES.INVALID_QR,
        methodAttempted: "QR",
      });
      throw new Error("INVALID_QR: companyId nao confere.");
    }

    if (parsed.date !== expectedDate) {
      await this.throwBlockedAttempt(user, metadata, {
        code: "QR_EXPIRED",
        message: QR_BLOCK_MESSAGES.QR_EXPIRED,
        methodAttempted: "QR",
        qrDate: parsed.date,
      });
      throw new Error("QR_EXPIRED: data nao confere.");
    }

    return parsed.date;
  }

  private async throwBlockedAttempt(
    user: AuthenticatedUser,
    metadata: { ip?: string; userAgent?: string } | undefined,
    options: {
      code: GeoBlockCode | QrBlockCode;
      message: string;
      details?: Record<string, number> | null;
      methodAttempted: PunchMethod;
      geoDecision?: GeoDecision;
      accuracy?: number | null;
      qrDate?: string | null;
    },
  ): Promise<never> {
    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "TIMECLOCK_PUNCH_BLOCKED",
        entity: "TimeClockEvent",
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
        payloadJson: JSON.stringify({
          reason: options.code,
          methodAttempted: options.methodAttempted,
          geoStatus: options.geoDecision?.geoStatus ?? null,
          distanceMeters: options.geoDecision?.geoDistanceMeters ?? null,
          radiusMeters: null,
          accuracy: options.accuracy ?? null,
          qrDate: options.qrDate ?? null,
        }),
      },
    });

    throw new ForbiddenException({
      code: options.code,
      message: options.message,
      details: options.details ?? null,
    });
  }

  private buildEmptyGeoDecision(): GeoDecision {
    return {
      blocked: false,
      geo: null,
      geoStatus: "MISSING",
      geoDistanceMeters: null,
    };
  }

  private normalizeFallbackMode(value?: string | null): PunchFallbackMode {
    if (value === "GEO_ONLY" || value === "GEO_OR_QR" || value === "QR_ONLY") {
      return value;
    }
    return "GEO_OR_QR";
  }

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private async getEmployeeProfile(user: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee profile not found");
    }

    return employee;
  }

  private async getCompanySettings(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (settings) {
      if (!settings.qrSecret || settings.qrSecret.trim() === "") {
        return this.prisma.companySettings.update({
          where: { companyId },
          data: { qrSecret: this.generateQrSecret() },
        });
      }
      return settings;
    }

    return this.prisma.companySettings.create({
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
    });
  }

  private evaluateGeo(settings: CompanySettingsSnapshot, geo: GeoInput | null): GeoDecision {
    if (!geo) {
      if (settings.geoRequired) {
        return {
          blocked: true,
          code: "GEO_REQUIRED",
          message: GEO_BLOCK_MESSAGES.GEO_REQUIRED,
          geo: null,
          geoStatus: "MISSING",
          geoDistanceMeters: null,
        };
      }
      return {
        blocked: false,
        geo: null,
        geoStatus: "MISSING",
        geoDistanceMeters: null,
      };
    }

    if (geo.accuracy > settings.maxAccuracyMeters) {
      return {
        blocked: true,
        code: "LOW_ACCURACY",
        message: GEO_BLOCK_MESSAGES.LOW_ACCURACY,
        geo,
        geoStatus: "LOW_ACCURACY",
        geoDistanceMeters: null,
        details: { accuracy: Math.round(geo.accuracy) },
      };
    }

    const distance = this.calculateDistanceMeters(
      geo.lat,
      geo.lng,
      settings.geofenceLat,
      settings.geofenceLng,
    );
    const distanceMeters = Math.round(distance);

    if (settings.geofenceEnabled && distanceMeters > settings.geofenceRadiusMeters) {
      return {
        blocked: true,
        code: "OUTSIDE_GEOFENCE",
        message: GEO_BLOCK_MESSAGES.OUTSIDE_GEOFENCE,
        geo,
        geoStatus: "OUTSIDE",
        geoDistanceMeters: distanceMeters,
        details: {
          distanceMeters,
          radiusMeters: settings.geofenceRadiusMeters,
        },
      };
    }

    return {
      blocked: false,
      geo,
      geoStatus: "OK",
      geoDistanceMeters: distanceMeters,
    };
  }

  private calculateDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) {
    const radius = 6371000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radius * c;
  }

  private getDayRange(reference = new Date()) {
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    const end = new Date(reference);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private getNextType(lastType: string | null): TimeClockType {
    if (!lastType) {
      return "IN";
    }
    if (!VALID_TYPES.includes(lastType as TimeClockType)) {
      throw new BadRequestException("Invalid last time clock event");
    }
    if (lastType === "OUT") {
      throw new BadRequestException("Workday already closed");
    }
    return NEXT_TYPE_MAP[lastType as Exclude<TimeClockType, "OUT">];
  }

  private getStatus(lastType: string | null) {
    if (!lastType) {
      return { currentType: null, nextType: "IN" };
    }
    if (!VALID_TYPES.includes(lastType as TimeClockType)) {
      return { currentType: null, nextType: "IN" };
    }
    if (lastType === "OUT") {
      return { currentType: "OUT", nextType: null };
    }
    return { currentType: lastType, nextType: NEXT_TYPE_MAP[lastType as Exclude<TimeClockType, "OUT">] };
  }

  private generateQrSecret() {
    return randomBytes(32).toString("hex");
  }
}
