import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { CreateKioskUserDto } from "./dto/create-kiosk-user.dto";

const TEMP_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

@Injectable()
export class AdminKioskService {
  constructor(private readonly prisma: PrismaService) {}

  async createKioskUser(dto: CreateKioskUserDto, admin: AuthenticatedUser) {
    const email = dto.email?.trim().toLowerCase() || this.generateKioskEmail();
    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          companyId: admin.companyId!,
          email,
          passwordHash,
          role: "KIOSK",
          isActive: true,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          companyId: admin.companyId!,
          userId: admin.id,
          action: "KIOSK_USER_CREATED",
          entity: "User",
          entityId: user.id,
        },
      });

      return {
        userId: user.id,
        email: user.email,
        temporaryPassword: tempPassword,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Email already exists");
      }
      throw error;
    }
  }

  private generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH) {
    const bytes = crypto.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i += 1) {
      password += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
    }
    return password;
  }

  private generateKioskEmail() {
    const suffix = crypto.randomBytes(3).toString("hex");
    return `kiosk.${suffix}@empresa.local`;
  }
}
