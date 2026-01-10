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
      // Usa raw SQL para criar usuário sem tentar incluir username
      const userId = `kiosk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, "companyId", email, "passwordHash", role, "isActive", "createdAt", "updatedAt") 
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        userId,
        admin.companyId!,
        email,
        passwordHash,
        "KIOSK",
        true
      );

      // Busca o usuário criado com select explícito
      const user = await this.prisma.user.findUnique({
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
        throw new Error("Falha ao criar usuário kiosk");
      }

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
