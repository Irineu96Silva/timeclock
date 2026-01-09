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
    // Usa raw SQL para buscar apenas campos que existem no banco
    let settings: any = null;
    
    try {
      // Tenta buscar com todos os campos usando select explícito
      settings = await this.prisma.companySettings.findUnique({
        where: { companyId },
        select: {
          companyId: true,
          geofenceEnabled: true,
          geoRequired: true,
          geofenceLat: true,
          geofenceLng: true,
          geofenceRadiusMeters: true,
          maxAccuracyMeters: true,
          qrEnabled: true,
          punchFallbackMode: true,
          qrSecret: true,
          kioskDeviceLabel: true,
          defaultWorkStartTime: true,
          defaultBreakStartTime: true,
          defaultBreakEndTime: true,
          defaultWorkEndTime: true,
          defaultToleranceMinutes: true,
          defaultTimezone: true,
        },
      });
    } catch (error: any) {
      // Se falhar por causa de campos que não existem, busca apenas campos básicos
      if (error.message?.includes("no column") || error.message?.includes("defaultWork")) {
        try {
          settings = await this.prisma.companySettings.findUnique({
            where: { companyId },
            select: {
              companyId: true,
              geofenceEnabled: true,
              geoRequired: true,
              geofenceLat: true,
              geofenceLng: true,
              geofenceRadiusMeters: true,
              maxAccuracyMeters: true,
              qrEnabled: true,
              punchFallbackMode: true,
              qrSecret: true,
              kioskDeviceLabel: true,
            },
          });
        } catch (fallbackError: any) {
          // Se ainda falhar, tenta com raw SQL
          try {
            const result = await this.prisma.$queryRawUnsafe(
              `SELECT 
                "companyId",
                "geofenceEnabled",
                "geoRequired",
                "geofenceLat",
                "geofenceLng",
                "geofenceRadiusMeters",
                "maxAccuracyMeters",
                "qrEnabled",
                "punchFallbackMode",
                "qrSecret",
                "kioskDeviceLabel"
              FROM "CompanySettings"
              WHERE "companyId" = ?
              LIMIT 1`,
              companyId
            ) as Array<{
              companyId: string;
              geofenceEnabled: number;
              geoRequired: number;
              geofenceLat: number;
              geofenceLng: number;
              geofenceRadiusMeters: number;
              maxAccuracyMeters: number;
              qrEnabled: number;
              punchFallbackMode: string;
              qrSecret: string;
              kioskDeviceLabel: string;
            }>;
            
            if (result.length > 0) {
              settings = {
                ...result[0],
                geofenceEnabled: Boolean(result[0].geofenceEnabled),
                geoRequired: Boolean(result[0].geoRequired),
                qrEnabled: Boolean(result[0].qrEnabled),
              };
            }
          } catch (rawError) {
            console.error("Erro ao buscar settings:", rawError);
            // settings permanece null
          }
        }
      } else {
        throw error;
      }
    }

    if (settings) {
      try {
        const ensured = await this.ensureQrSecret(companyId, settings.qrSecret || "");
        return this.pickPublicSettings({ ...settings, qrSecret: ensured });
      } catch (error: any) {
        // Se falhar ao garantir QR secret, retorna sem ele
        console.error("Erro ao garantir QR secret:", error.message);
        return this.pickPublicSettings({ ...settings, qrSecret: settings.qrSecret || "" });
      }
    }

    // Se não existe, cria com campos básicos primeiro
    let created;
    try {
      // Tenta criar com todos os campos
      created = await this.prisma.companySettings.create({
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
    } catch (error: any) {
      // Se campos novos não existirem, cria apenas com campos básicos
      if (error.message?.includes("no column") || error.message?.includes("defaultWork")) {
        created = await this.prisma.companySettings.create({
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
      } else {
        throw error;
      }
    }

    return this.pickPublicSettings(created);
  }

  async updateSettings(companyId: string, dto: UpdateSettingsDto): Promise<PublicSettings> {
    // Usa raw SQL diretamente para garantir compatibilidade com Turso
    // Verifica se existe primeiro
    const existing = await this.prisma.$queryRawUnsafe<Array<{ companyId: string }>>(
      `SELECT "companyId" FROM "CompanySettings" WHERE "companyId" = ? LIMIT 1`,
      companyId
    );

    if (existing.length === 0) {
      // Se não existe, cria com campos básicos usando raw SQL
      const qrSecret = this.generateQrSecret();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "CompanySettings" 
         ("companyId", "geofenceEnabled", "geoRequired", "geofenceLat", "geofenceLng", 
          "geofenceRadiusMeters", "maxAccuracyMeters", "qrEnabled", "punchFallbackMode", 
          "qrSecret", "kioskDeviceLabel")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        companyId,
        dto.geofenceEnabled ?? true,
        dto.geoRequired ?? true,
        dto.geofenceLat ?? 0,
        dto.geofenceLng ?? 0,
        dto.geofenceRadiusMeters ?? 200,
        dto.maxAccuracyMeters ?? 100,
        dto.qrEnabled ?? true,
        dto.punchFallbackMode ?? "GEO_OR_QR",
        qrSecret,
        dto.kioskDeviceLabel?.trim() ?? ""
      );
    } else {
      // Se existe, atualiza apenas campos básicos usando raw SQL
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      
      if (dto.geofenceLat !== undefined) {
        updateFields.push(`"geofenceLat" = ?`);
        updateValues.push(dto.geofenceLat);
      }
      if (dto.geofenceLng !== undefined) {
        updateFields.push(`"geofenceLng" = ?`);
        updateValues.push(dto.geofenceLng);
      }
      if (dto.geofenceRadiusMeters !== undefined) {
        updateFields.push(`"geofenceRadiusMeters" = ?`);
        updateValues.push(dto.geofenceRadiusMeters);
      }
      if (dto.maxAccuracyMeters !== undefined) {
        updateFields.push(`"maxAccuracyMeters" = ?`);
        updateValues.push(dto.maxAccuracyMeters);
      }
      if (dto.geofenceEnabled !== undefined) {
        updateFields.push(`"geofenceEnabled" = ?`);
        updateValues.push(dto.geofenceEnabled ? 1 : 0);
      }
      if (dto.geoRequired !== undefined) {
        updateFields.push(`"geoRequired" = ?`);
        updateValues.push(dto.geoRequired ? 1 : 0);
      }
      if (dto.qrEnabled !== undefined) {
        updateFields.push(`"qrEnabled" = ?`);
        updateValues.push(dto.qrEnabled ? 1 : 0);
      }
      if (dto.punchFallbackMode !== undefined) {
        updateFields.push(`"punchFallbackMode" = ?`);
        updateValues.push(dto.punchFallbackMode);
      }
      if (dto.kioskDeviceLabel !== undefined) {
        updateFields.push(`"kioskDeviceLabel" = ?`);
        updateValues.push(dto.kioskDeviceLabel.trim());
      }
      
      if (updateFields.length > 0) {
        updateValues.push(companyId);
        await this.prisma.$executeRawUnsafe(
          `UPDATE "CompanySettings" SET ${updateFields.join(", ")} WHERE "companyId" = ?`,
          ...updateValues
        );
      }
    }
    
    // Busca as configurações atualizadas usando raw SQL
    const result = await this.prisma.$queryRawUnsafe<Array<{
      companyId: string;
      geofenceEnabled: number;
      geoRequired: number;
      geofenceLat: number;
      geofenceLng: number;
      geofenceRadiusMeters: number;
      maxAccuracyMeters: number;
      qrEnabled: number;
      punchFallbackMode: string;
      qrSecret: string;
      kioskDeviceLabel: string;
    }>>(
      `SELECT 
        "companyId",
        "geofenceEnabled",
        "geoRequired",
        "geofenceLat",
        "geofenceLng",
        "geofenceRadiusMeters",
        "maxAccuracyMeters",
        "qrEnabled",
        "punchFallbackMode",
        "qrSecret",
        "kioskDeviceLabel"
      FROM "CompanySettings"
      WHERE "companyId" = ?
      LIMIT 1`,
      companyId
    );
    
    if (result.length === 0) {
      throw new Error("Configurações não encontradas após atualização");
    }
    
    const settings = {
      ...result[0],
      geofenceEnabled: Boolean(result[0].geofenceEnabled),
      geoRequired: Boolean(result[0].geoRequired),
      qrEnabled: Boolean(result[0].qrEnabled),
      defaultWorkStartTime: null,
      defaultBreakStartTime: null,
      defaultBreakEndTime: null,
      defaultWorkEndTime: null,
      defaultToleranceMinutes: null,
      defaultTimezone: null,
    };
    
    return this.pickPublicSettings(settings);
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

  private async ensureQrSecret(companyId: string, currentSecret: string): Promise<string> {
    if (currentSecret && currentSecret.trim() !== "") {
      return currentSecret;
    }
    const secret = this.generateQrSecret();
    try {
      await this.prisma.companySettings.update({
        where: { companyId },
        data: { qrSecret: secret },
      });
    } catch (error: any) {
      // Se falhar ao atualizar, tenta com raw SQL
      if (error.message?.includes("no column") || error.code === "SQLITE_UNKNOWN") {
        try {
          await this.prisma.$executeRawUnsafe(
            `UPDATE "CompanySettings" SET "qrSecret" = ? WHERE "companyId" = ?`,
            secret,
            companyId
          );
        } catch (sqlError: any) {
          // Se ainda falhar, apenas retorna o secret gerado
          console.error("Erro ao atualizar QR secret com raw SQL:", sqlError.message);
        }
      } else {
        // Se ainda falhar, apenas retorna o secret gerado
        console.error("Erro ao atualizar QR secret:", error.message);
      }
    }
    return secret;
  }

  private generateQrSecret() {
    return randomBytes(32).toString("hex");
  }
}
