import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

type PublicSettings = {
  geofenceEnabled: boolean;
  geoRequired: boolean;
  geofenceLat: number;
  geofenceLng: number;
  geofenceRadiusMeters: number;
  maxAccuracyMeters: number;
  qrEnabled: boolean;
  punchFallbackMode: string;
  kioskDeviceLabel: string;
  defaultWorkStartTime: string | null;
  defaultBreakStartTime: string | null;
  defaultBreakEndTime: string | null;
  defaultWorkEndTime: string | null;
  defaultToleranceMinutes: number | null;
  defaultTimezone: string | null;
};

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(companyId: string): Promise<PublicSettings> {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (settings) {
      const ensured = await this.ensureQrSecret(companyId, settings.qrSecret);
      return this.pickPublicSettings({ ...settings, qrSecret: ensured });
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
        defaultWorkStartTime: "08:00",
        defaultBreakStartTime: "12:00",
        defaultBreakEndTime: "13:00",
        defaultWorkEndTime: "17:00",
        defaultToleranceMinutes: 5,
        defaultTimezone: "America/Sao_Paulo",
      },
    });

    return this.pickPublicSettings(created);
  }

  async updateSettings(companyId: string, dto: UpdateSettingsDto): Promise<PublicSettings> {
    const updateData: Record<string, number | boolean | string> = {};

    if (dto.geofenceLat !== undefined) updateData.geofenceLat = dto.geofenceLat;
    if (dto.geofenceLng !== undefined) updateData.geofenceLng = dto.geofenceLng;
    if (dto.geofenceRadiusMeters !== undefined) {
      updateData.geofenceRadiusMeters = dto.geofenceRadiusMeters;
    }
    if (dto.maxAccuracyMeters !== undefined) updateData.maxAccuracyMeters = dto.maxAccuracyMeters;
    if (dto.geofenceEnabled !== undefined) updateData.geofenceEnabled = dto.geofenceEnabled;
    if (dto.geoRequired !== undefined) updateData.geoRequired = dto.geoRequired;
    if (dto.qrEnabled !== undefined) updateData.qrEnabled = dto.qrEnabled;
    if (dto.punchFallbackMode !== undefined) {
      updateData.punchFallbackMode = dto.punchFallbackMode;
    }
    if (dto.kioskDeviceLabel !== undefined) {
      updateData.kioskDeviceLabel = dto.kioskDeviceLabel.trim();
    }
    if (dto.defaultWorkStartTime !== undefined) {
      updateData.defaultWorkStartTime = dto.defaultWorkStartTime;
    }
    if (dto.defaultBreakStartTime !== undefined) {
      updateData.defaultBreakStartTime = dto.defaultBreakStartTime;
    }
    if (dto.defaultBreakEndTime !== undefined) {
      updateData.defaultBreakEndTime = dto.defaultBreakEndTime;
    }
    if (dto.defaultWorkEndTime !== undefined) {
      updateData.defaultWorkEndTime = dto.defaultWorkEndTime;
    }
    if (dto.defaultToleranceMinutes !== undefined) {
      updateData.defaultToleranceMinutes = dto.defaultToleranceMinutes;
    }
    if (dto.defaultTimezone !== undefined) {
      updateData.defaultTimezone = dto.defaultTimezone;
    }

    const createData = {
      companyId,
      geofenceEnabled: dto.geofenceEnabled ?? true,
      geoRequired: dto.geoRequired ?? true,
      geofenceLat: dto.geofenceLat ?? 0,
      geofenceLng: dto.geofenceLng ?? 0,
      geofenceRadiusMeters: dto.geofenceRadiusMeters ?? 200,
      maxAccuracyMeters: dto.maxAccuracyMeters ?? 100,
      qrEnabled: dto.qrEnabled ?? true,
      punchFallbackMode: dto.punchFallbackMode ?? "GEO_OR_QR",
      qrSecret: this.generateQrSecret(),
      kioskDeviceLabel: dto.kioskDeviceLabel?.trim() ?? "",
      defaultWorkStartTime: dto.defaultWorkStartTime ?? "08:00",
      defaultBreakStartTime: dto.defaultBreakStartTime ?? "12:00",
      defaultBreakEndTime: dto.defaultBreakEndTime ?? "13:00",
      defaultWorkEndTime: dto.defaultWorkEndTime ?? "17:00",
      defaultToleranceMinutes: dto.defaultToleranceMinutes ?? 5,
      defaultTimezone: dto.defaultTimezone ?? "America/Sao_Paulo",
    };

    const updated = await this.prisma.companySettings.upsert({
      where: { companyId },
      update: updateData,
      create: createData,
    });

    return this.pickPublicSettings(updated);
  }

  async regenerateQrSecret(companyId: string) {
    const secret = this.generateQrSecret();
    await this.prisma.companySettings.upsert({
      where: { companyId },
      update: { qrSecret: secret },
      create: {
        companyId,
        geofenceEnabled: true,
        geoRequired: true,
        geofenceLat: 0,
        geofenceLng: 0,
        geofenceRadiusMeters: 200,
        maxAccuracyMeters: 100,
        qrEnabled: true,
        punchFallbackMode: "GEO_OR_QR",
        qrSecret: secret,
        kioskDeviceLabel: "",
      },
    });
    return { success: true };
  }

  private pickPublicSettings(settings: {
    geofenceEnabled: boolean;
    geoRequired: boolean;
    geofenceLat: number;
    geofenceLng: number;
    geofenceRadiusMeters: number;
    maxAccuracyMeters: number;
    qrEnabled: boolean;
    punchFallbackMode: string;
    qrSecret: string;
    kioskDeviceLabel: string;
    defaultWorkStartTime?: string | null;
    defaultBreakStartTime?: string | null;
    defaultBreakEndTime?: string | null;
    defaultWorkEndTime?: string | null;
    defaultToleranceMinutes?: number | null;
    defaultTimezone?: string | null;
  }): PublicSettings {
    return {
      geofenceEnabled: settings.geofenceEnabled,
      geoRequired: settings.geoRequired,
      geofenceLat: settings.geofenceLat,
      geofenceLng: settings.geofenceLng,
      geofenceRadiusMeters: settings.geofenceRadiusMeters,
      maxAccuracyMeters: settings.maxAccuracyMeters,
      qrEnabled: settings.qrEnabled,
      punchFallbackMode: settings.punchFallbackMode,
      kioskDeviceLabel: settings.kioskDeviceLabel ?? "",
      defaultWorkStartTime: settings.defaultWorkStartTime ?? null,
      defaultBreakStartTime: settings.defaultBreakStartTime ?? null,
      defaultBreakEndTime: settings.defaultBreakEndTime ?? null,
      defaultWorkEndTime: settings.defaultWorkEndTime ?? null,
      defaultToleranceMinutes: settings.defaultToleranceMinutes ?? null,
      defaultTimezone: settings.defaultTimezone ?? null,
    };
  }

  private async ensureQrSecret(companyId: string, currentSecret: string) {
    if (currentSecret && currentSecret.trim() !== "") {
      return currentSecret;
    }
    const secret = this.generateQrSecret();
    await this.prisma.companySettings.update({
      where: { companyId },
      data: { qrSecret: secret },
    });
    return secret;
  }

  private generateQrSecret() {
    return randomBytes(32).toString("hex");
  }
}
