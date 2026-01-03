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
