import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { buildEmployeeQrToken } from "../utils/qr-signing";
import { isValidTimeString, parseTimeToMinutes, resolveTimeZone } from "../utils/time-utils";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { SetEmployeePinDto } from "./dto/set-employee-pin.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

type EmployeeListItem = {
  id: string;
  fullName: string;
  document: string | null;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  workStartTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  workEndTime: string | null;
  toleranceMinutes: number | null;
  timezone: string | null;
};

type ScheduleSnapshot = {
  workStartTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  workEndTime: string | null;
  toleranceMinutes: number | null;
  timezone: string | null;
};

type NormalizedScheduleInput = {
  workStartTime?: string | null;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  workEndTime?: string | null;
  toleranceMinutes?: number | null;
  timezone?: string | null;
};

const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto, admin: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();
    const tempPassword = dto.password?.trim() || this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const scheduleInput = this.normalizeScheduleInput(dto);
    const schedule = this.mergeSchedule(this.emptySchedule(), scheduleInput);
    this.validateSchedule(schedule);

    try {
      const { user, employee } = await this.prisma.$transaction(async (tx) => {
        // Usa raw SQL para criar usuário sem tentar incluir username
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await tx.$executeRawUnsafe(
          `INSERT INTO "User" (id, "companyId", email, "passwordHash", role, "isActive", "createdAt", "updatedAt") 
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          userId,
          admin.companyId!,
          email,
          passwordHash,
          "EMPLOYEE",
          true
        );

        // Busca o usuário criado com select explícito
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            companyId: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!user) {
          throw new Error("Falha ao criar usuário");
        }

        const employee = await tx.employeeProfile.create({
          data: {
            company: { connect: { id: admin.companyId! } },
            user: { connect: { id: user.id } },
            fullName,
            document: dto.document?.trim() || null,
            isActive: true,
            workStartTime: schedule.workStartTime,
            breakStartTime: schedule.breakStartTime,
            breakEndTime: schedule.breakEndTime,
            workEndTime: schedule.workEndTime,
            toleranceMinutes: schedule.toleranceMinutes ?? 5,
            timezone: schedule.timezone ?? "America/Sao_Paulo",
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: admin.companyId!,
            userId: admin.id,
            action: "EMPLOYEE_CREATED",
            entity: "EmployeeProfile",
            entityId: employee.id,
          },
        });

        return { user, employee };
      });

      return {
        employeeId: employee.id,
        userId: user.id,
        email: user.email,
        fullName: employee.fullName,
        temporaryPassword: dto.password ? undefined : tempPassword,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Email already exists");
      }
      throw error;
    }
  }

  async findAll(admin: AuthenticatedUser): Promise<EmployeeListItem[]> {
    const rows = await this.prisma.employeeProfile.findMany({
      where: { companyId: admin.companyId! },
      select: {
        id: true,
        fullName: true,
        document: true,
        isActive: true,
        workStartTime: true,
        breakStartTime: true,
        breakEndTime: true,
        workEndTime: true,
        toleranceMinutes: true,
        timezone: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows;
  }

  async update(id: string, dto: UpdateEmployeeDto, admin: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId! },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const scheduleInput = this.normalizeScheduleInput(dto);
    const schedule = this.mergeSchedule(
      {
        workStartTime: employee.workStartTime ?? null,
        breakStartTime: employee.breakStartTime ?? null,
        breakEndTime: employee.breakEndTime ?? null,
        workEndTime: employee.workEndTime ?? null,
        toleranceMinutes: employee.toleranceMinutes ?? null,
        timezone: employee.timezone ?? null,
      },
      scheduleInput,
    );

    this.validateSchedule(schedule);

    const data: Prisma.EmployeeProfileUpdateInput = {
      fullName: dto.fullName?.trim(),
      document: dto.document?.trim(),
      isActive: dto.isActive,
    };

    this.applyScheduleUpdates(dto, scheduleInput, data);

    const updated = await this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: admin.companyId!,
        userId: admin.id,
        action: "EMPLOYEE_UPDATED",
        entity: "EmployeeProfile",
        entityId: updated.id,
      },
    });

    return updated;
  }

  async resetPassword(id: string, admin: AuthenticatedUser) {
    // Busca employee com select explícito para user (sem username)
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId! },
      select: {
        id: true,
        userId: true,
        fullName: true,
        companyId: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            companyId: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // Usa raw SQL para atualizar passwordHash sem tentar atualizar username
      try {
        await tx.$executeRawUnsafe(
          `UPDATE "User" SET "passwordHash" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
          passwordHash,
          employee.userId
        );
      } catch (error: any) {
        // Fallback para Prisma se raw SQL falhar
        try {
          await tx.user.update({
            where: { id: employee.userId },
            data: { passwordHash },
          });
        } catch {
          throw new Error("Erro ao atualizar senha do usuário");
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: admin.companyId!,
          userId: admin.id,
          action: "EMPLOYEE_PASSWORD_RESET",
          entity: "EmployeeProfile",
          entityId: employee.id,
        },
      });
    });

    return { temporaryPassword };
  }

  async setPin(id: string, dto: SetEmployeePinDto, admin: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId! },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const updated = await this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data: {
        pinHash,
        pinUpdatedAt: new Date(),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: admin.companyId!,
        userId: admin.id,
        action: "ADMIN_SET_PIN",
        entity: "EmployeeProfile",
        entityId: updated.id,
      },
    });

    return { success: true };
  }

  async resetPin(id: string, admin: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId! },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const pin = this.generateNumericPin();
    const pinHash = await bcrypt.hash(pin, 10);

    await this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data: {
        pinHash,
        pinUpdatedAt: new Date(),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: admin.companyId!,
        userId: admin.id,
        action: "ADMIN_RESET_PIN",
        entity: "EmployeeProfile",
        entityId: employee.id,
      },
    });

    return { pin };
  }

  async regenerateEmployeeQr(id: string, admin: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId! },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const settings = await this.getCompanySettings(admin.companyId!);
    const token = buildEmployeeQrToken(admin.companyId!, employee.id, settings.qrSecret);

    await this.prisma.auditLog.create({
      data: {
        companyId: admin.companyId!,
        userId: admin.id,
        action: "EMPLOYEE_QR_REGENERATED",
        entity: "EmployeeProfile",
        entityId: employee.id,
      },
    });

    return { employeeQrToken: token };
  }

  async delete(id: string, admin: AuthenticatedUser) {
    // Busca employee com select explícito
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId! },
      select: {
        id: true,
        userId: true,
        fullName: true,
        companyId: true,
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    await this.prisma.$transaction(async (tx) => {
      // Deleta o employee profile primeiro (cascade vai deletar relacionamentos)
      await tx.employeeProfile.delete({
        where: { id: employee.id },
      });

      // Deleta o usuário associado usando raw SQL para evitar erro de username
      try {
        await tx.$executeRawUnsafe(
          `DELETE FROM "User" WHERE "id" = ?`,
          employee.userId
        );
      } catch (error: any) {
        // Se falhar, tenta com Prisma (pode funcionar se username existir)
        try {
          await tx.user.delete({
            where: { id: employee.userId },
          });
        } catch {
          // Ignora erro se ambos falharem (pode já ter sido deletado por cascade)
          console.warn(`Erro ao deletar usuário ${employee.userId}, pode já ter sido deletado por cascade`);
        }
      }

      // Cria log de auditoria
      await tx.auditLog.create({
        data: {
          companyId: admin.companyId!,
          userId: admin.id,
          action: "EMPLOYEE_DELETED",
          entity: "EmployeeProfile",
          entityId: employee.id,
          payloadJson: JSON.stringify({
            fullName: employee.fullName,
            userId: employee.userId,
          }),
        },
      });
    });

    return { success: true, message: "Colaborador excluído com sucesso" };
  }

  private generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH) {
    const bytes = crypto.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i += 1) {
      password += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
    }
    return password;
  }

  private generateNumericPin() {
    const bytes = crypto.randomBytes(2);
    const value = ((bytes[0] << 8) + bytes[1]) % 10000;
    return value.toString().padStart(4, "0");
  }

  private async getCompanySettings(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });

    if (settings) {
      if (!settings.qrSecret || settings.qrSecret.trim() === "") {
        return this.prisma.companySettings.update({
          where: { companyId },
          data: { qrSecret: crypto.randomBytes(32).toString("hex") },
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
        qrSecret: crypto.randomBytes(32).toString("hex"),
        kioskDeviceLabel: "",
      },
    });
  }

  private emptySchedule(): ScheduleSnapshot {
    return {
      workStartTime: null,
      breakStartTime: null,
      breakEndTime: null,
      workEndTime: null,
      toleranceMinutes: null,
      timezone: null,
    };
  }

  private normalizeScheduleInput(input: Partial<ScheduleSnapshot>): NormalizedScheduleInput {
    return {
      workStartTime: this.normalizeTimeInput(input.workStartTime),
      breakStartTime: this.normalizeTimeInput(input.breakStartTime),
      breakEndTime: this.normalizeTimeInput(input.breakEndTime),
      workEndTime: this.normalizeTimeInput(input.workEndTime),
      toleranceMinutes: this.normalizeNumberInput(input.toleranceMinutes),
      timezone: this.normalizeTimezoneInput(input.timezone),
    };
  }

  private normalizeTimeInput(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeTimezoneInput(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeNumberInput(value?: number | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    return Number.isNaN(value) ? null : value;
  }

  private mergeSchedule(current: ScheduleSnapshot, input: NormalizedScheduleInput): ScheduleSnapshot {
    return {
      workStartTime: input.workStartTime !== undefined ? input.workStartTime : current.workStartTime,
      breakStartTime:
        input.breakStartTime !== undefined ? input.breakStartTime : current.breakStartTime,
      breakEndTime: input.breakEndTime !== undefined ? input.breakEndTime : current.breakEndTime,
      workEndTime: input.workEndTime !== undefined ? input.workEndTime : current.workEndTime,
      toleranceMinutes:
        input.toleranceMinutes !== undefined ? input.toleranceMinutes : current.toleranceMinutes,
      timezone: input.timezone !== undefined ? input.timezone : current.timezone,
    };
  }

  private validateSchedule(schedule: ScheduleSnapshot) {
    const timeValues = [
      schedule.workStartTime,
      schedule.breakStartTime,
      schedule.breakEndTime,
      schedule.workEndTime,
    ];

    for (const value of timeValues) {
      if (value && !isValidTimeString(value)) {
        throw new BadRequestException("Horario invalido.");
      }
    }

    const hasBreakStart = Boolean(schedule.breakStartTime);
    const hasBreakEnd = Boolean(schedule.breakEndTime);
    if (hasBreakStart !== hasBreakEnd) {
      throw new BadRequestException("Informe inicio e fim da pausa.");
    }

    const hasWorkStart = Boolean(schedule.workStartTime);
    const hasWorkEnd = Boolean(schedule.workEndTime);
    if (hasWorkStart !== hasWorkEnd) {
      throw new BadRequestException("Informe inicio e fim da jornada.");
    }

    if (schedule.workStartTime && schedule.workEndTime) {
      if (parseTimeToMinutes(schedule.workStartTime) >= parseTimeToMinutes(schedule.workEndTime)) {
        throw new BadRequestException("Horario de trabalho invalido.");
      }
    }

    if (schedule.breakStartTime && schedule.breakEndTime) {
      if (
        parseTimeToMinutes(schedule.breakStartTime) >= parseTimeToMinutes(schedule.breakEndTime)
      ) {
        throw new BadRequestException("Horario de pausa invalido.");
      }
    }

    if (schedule.timezone && !resolveTimeZone(schedule.timezone)) {
      throw new BadRequestException("Timezone invalido.");
    }
  }

  private applyScheduleUpdates(
    dto: UpdateEmployeeDto,
    scheduleInput: NormalizedScheduleInput,
    data: Prisma.EmployeeProfileUpdateInput,
  ) {
    if (Object.prototype.hasOwnProperty.call(dto, "workStartTime")) {
      data.workStartTime =
        scheduleInput.workStartTime === undefined ? undefined : scheduleInput.workStartTime;
    }

    if (Object.prototype.hasOwnProperty.call(dto, "breakStartTime")) {
      data.breakStartTime =
        scheduleInput.breakStartTime === undefined ? undefined : scheduleInput.breakStartTime;
    }

    if (Object.prototype.hasOwnProperty.call(dto, "breakEndTime")) {
      data.breakEndTime =
        scheduleInput.breakEndTime === undefined ? undefined : scheduleInput.breakEndTime;
    }

    if (Object.prototype.hasOwnProperty.call(dto, "workEndTime")) {
      data.workEndTime =
        scheduleInput.workEndTime === undefined ? undefined : scheduleInput.workEndTime;
    }

    if (Object.prototype.hasOwnProperty.call(dto, "toleranceMinutes")) {
      data.toleranceMinutes =
        scheduleInput.toleranceMinutes === undefined ? undefined : scheduleInput.toleranceMinutes;
    }

    if (Object.prototype.hasOwnProperty.call(dto, "timezone")) {
      data.timezone = scheduleInput.timezone === undefined ? undefined : scheduleInput.timezone;
    }
  }
}
