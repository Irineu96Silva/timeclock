import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { buildQrPayload } from "../utils/qr-signing";

@Injectable()
export class KioskService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayQr(user: AuthenticatedUser) {
    const settings = await this.getCompanySettings(user.companyId);
    const date = this.formatDate(new Date());
    const qrToken = buildQrPayload(user.companyId, date, settings.qrSecret);
    const expiresAt = this.getNextDayStart(new Date()).toISOString();

    return { date, qrToken, expiresAt, deviceLabel: settings.kioskDeviceLabel };
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

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getNextDayStart(reference: Date) {
    const next = new Date(reference);
    next.setHours(24, 0, 0, 0);
    return next;
  }

  private generateQrSecret() {
    return randomBytes(32).toString("hex");
  }
}
