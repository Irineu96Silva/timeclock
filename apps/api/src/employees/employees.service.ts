import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { buildEmployeeQrToken } from "../utils/qr-signing";
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

    try {
      const { user, employee } = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            companyId: admin.companyId,
            email,
            passwordHash,
            role: "EMPLOYEE",
            isActive: true,
          },
        });

        const employee = await tx.employeeProfile.create({
          data: {
            companyId: admin.companyId,
            userId: user.id,
            fullName,
            document: dto.document?.trim(),
            isActive: true,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: admin.companyId,
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
    return this.prisma.employeeProfile.findMany({
      where: { companyId: admin.companyId },
      select: {
        id: true,
        fullName: true,
        document: true,
        isActive: true,
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
  }

  async update(id: string, dto: UpdateEmployeeDto, admin: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const updated = await this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data: {
        fullName: dto.fullName?.trim(),
        document: dto.document?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId: admin.companyId,
        userId: admin.id,
        action: "EMPLOYEE_UPDATED",
        entity: "EmployeeProfile",
        entityId: updated.id,
      },
    });

    return updated;
  }

  async resetPassword(id: string, admin: AuthenticatedUser) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, companyId: admin.companyId },
      include: {
        user: true,
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: employee.userId },
        data: { passwordHash },
      });

      await tx.auditLog.create({
        data: {
          companyId: admin.companyId,
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
      where: { id, companyId: admin.companyId },
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
        companyId: admin.companyId,
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
      where: { id, companyId: admin.companyId },
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
        companyId: admin.companyId,
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
      where: { id, companyId: admin.companyId },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const settings = await this.getCompanySettings(admin.companyId);
    const token = buildEmployeeQrToken(admin.companyId, employee.id, settings.qrSecret);

    await this.prisma.auditLog.create({
      data: {
        companyId: admin.companyId,
        userId: admin.id,
        action: "EMPLOYEE_QR_REGENERATED",
        entity: "EmployeeProfile",
        entityId: employee.id,
      },
    });

    return { employeeQrToken: token };
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
}
