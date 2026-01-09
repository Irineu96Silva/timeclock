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
            const result = await this.prisma.$queryRaw<Array<{
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
            }>>`
              SELECT 
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
              WHERE "companyId" = ${companyId}
              LIMIT 1
            `;
            
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
      const ensured = await this.ensureQrSecret(companyId, settings.qrSecret || "");
      return this.pickPublicSettings({ ...settings, qrSecret: ensured });
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
    // Primeiro, verifica se as configurações existem usando select explícito
    let existing: any = null;
    try {
      existing = await this.prisma.companySettings.findUnique({
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
          existing = await this.prisma.companySettings.findUnique({
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
        } catch (fallbackError) {
          // Se ainda falhar, existing permanece null
          console.error("Erro ao buscar settings:", fallbackError);
        }
      } else {
        throw error;
      }
    }

    // Campos básicos que sempre existem
    const baseUpdateData: Record<string, number | boolean | string> = {};
    if (dto.geofenceLat !== undefined) baseUpdateData.geofenceLat = dto.geofenceLat;
    if (dto.geofenceLng !== undefined) baseUpdateData.geofenceLng = dto.geofenceLng;
    if (dto.geofenceRadiusMeters !== undefined) {
      baseUpdateData.geofenceRadiusMeters = dto.geofenceRadiusMeters;
    }
    if (dto.maxAccuracyMeters !== undefined) baseUpdateData.maxAccuracyMeters = dto.maxAccuracyMeters;
    if (dto.geofenceEnabled !== undefined) baseUpdateData.geofenceEnabled = dto.geofenceEnabled;
    if (dto.geoRequired !== undefined) baseUpdateData.geoRequired = dto.geoRequired;
    if (dto.qrEnabled !== undefined) baseUpdateData.qrEnabled = dto.qrEnabled;
    if (dto.punchFallbackMode !== undefined) {
      baseUpdateData.punchFallbackMode = dto.punchFallbackMode;
    }
    if (dto.kioskDeviceLabel !== undefined) {
      baseUpdateData.kioskDeviceLabel = dto.kioskDeviceLabel.trim();
    }

    // Campos novos que podem não existir no banco
    // Só adiciona se o existing tiver esses campos (ou seja, se foram buscados com sucesso)
    const extendedUpdateData: Record<string, number | boolean | string | null> = {
      ...baseUpdateData,
    };
    
    // Tenta adicionar campos novos apenas se o registro já existe E se os campos foram buscados
    // Se existing não tem esses campos, significa que não existem no banco
    if (existing && 'defaultWorkStartTime' in existing) {
      if (dto.defaultWorkStartTime !== undefined) {
        extendedUpdateData.defaultWorkStartTime = dto.defaultWorkStartTime;
      }
      if (dto.defaultBreakStartTime !== undefined) {
        extendedUpdateData.defaultBreakStartTime = dto.defaultBreakStartTime;
      }
      if (dto.defaultBreakEndTime !== undefined) {
        extendedUpdateData.defaultBreakEndTime = dto.defaultBreakEndTime;
      }
      if (dto.defaultWorkEndTime !== undefined) {
        extendedUpdateData.defaultWorkEndTime = dto.defaultWorkEndTime;
      }
      if (dto.defaultToleranceMinutes !== undefined) {
        extendedUpdateData.defaultToleranceMinutes = dto.defaultToleranceMinutes;
      }
      if (dto.defaultTimezone !== undefined) {
        extendedUpdateData.defaultTimezone = dto.defaultTimezone;
      }
    }

    // Se não existe, cria apenas com campos básicos
    if (!existing) {
      const created = await this.prisma.companySettings.create({
        data: {
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
        },
      });
      return this.pickPublicSettings(created);
    }

    // Se existe, atualiza (tenta com campos novos, se falhar tenta sem)
    try {
      // Primeiro tenta atualizar com todos os campos
      const updated = await this.prisma.companySettings.update({
        where: { companyId },
        data: extendedUpdateData,
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
      return this.pickPublicSettings(updated);
    } catch (error: any) {
      // Se falhar por causa de campos que não existem, tenta apenas com campos básicos
      if (error.message?.includes("no column") || error.code === "SQLITE_UNKNOWN" || error.message?.includes("defaultWork")) {
        try {
          const updated = await this.prisma.companySettings.update({
            where: { companyId },
            data: baseUpdateData,
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
          return this.pickPublicSettings(updated);
        } catch (fallbackError: any) {
          // Se ainda falhar, tenta com raw SQL para atualizar apenas campos básicos
          console.error("Erro ao atualizar settings com Prisma, tentando raw SQL...", fallbackError.message);
          try {
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
            
            // Busca novamente para retornar
            const updated = await this.prisma.companySettings.findUnique({
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
            
            if (!updated) {
              throw new Error("Configurações não encontradas após atualização");
            }
            
            return this.pickPublicSettings(updated);
          } catch (rawError: any) {
            console.error("Erro ao atualizar settings com raw SQL:", rawError);
            throw new Error("Erro ao salvar configurações. Tente novamente.");
          }
        }
      }
      throw error;
    }
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
