import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { KioskPunchDto } from "./dto/kiosk-punch.dto";

@Injectable()
export class KioskPunchService {
  constructor(private readonly prisma: PrismaService) {}

  async punch(
    user: AuthenticatedUser,
    dto: KioskPunchDto,
    metadata?: { ip?: string; userAgent?: string },
  ) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: dto.employeeId,
        companyId: user.companyId,
        isActive: true,
        user: { isActive: true },
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (!employee) {
      await this.logPunchBlocked(user, dto, "EMPLOYEE_NOT_FOUND", metadata);
      throw new NotFoundException("Colaborador nao encontrado");
    }

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
      select: { type: true },
    });

    const nextType = this.getNextEventType(lastEvent?.type ?? null);
    const timestamp = new Date();

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.timeClockEvent.create({
        data: {
          companyId: user.companyId,
          employeeId: employee.id,
          type: nextType,
          timestamp,
          source: "KIOSK",
          deviceId: dto.deviceLabel?.trim() || null,
          ip: metadata?.ip,
          userAgent: metadata?.userAgent,
          geoStatus: "MISSING",
          punchMethod: "KIOSK",
          qrDate: null,
          qrNonce: null,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: "KIOSK_PUNCH",
          entity: "TimeClockEvent",
          entityId: created.id,
          payloadJson: JSON.stringify({
            employeeId: employee.id,
            eventType: created.type,
            method: dto.method,
            deviceLabel: dto.deviceLabel?.trim() || null,
          }),
        },
      });

      return created;
    });

    return {
      eventType: event.type,
      timestamp: event.timestamp,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
      },
      statusNow: this.getStatusNow(event.type),
    };
  }

  private async logPunchBlocked(
    user: AuthenticatedUser,
    dto: KioskPunchDto,
    reason: string,
    metadata?: { ip?: string; userAgent?: string },
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "KIOSK_PUNCH_BLOCKED",
        entity: "EmployeeProfile",
        entityId: dto.employeeId,
        ip: metadata?.ip,
        userAgent: metadata?.userAgent,
        payloadJson: JSON.stringify({
          reason,
          method: dto.method,
          deviceLabel: dto.deviceLabel?.trim() || null,
          employeeId: dto.employeeId,
        }),
      },
    });
  }

  private getNextEventType(lastType: string | null): "IN" | "BREAK_START" | "BREAK_END" | "OUT" {
    if (!lastType || lastType === "OUT") {
      return "IN";
    }
    if (lastType === "IN") {
      return "BREAK_START";
    }
    if (lastType === "BREAK_START") {
      return "BREAK_END";
    }
    return "OUT";
  }

  private getStatusNow(type: string): "TRABALHANDO" | "EM_PAUSA" | "FORA" {
    if (type === "BREAK_START") {
      return "EM_PAUSA";
    }
    if (type === "OUT") {
      return "FORA";
    }
    return "TRABALHANDO";
  }

  private getDayRange(reference = new Date()) {
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    const end = new Date(reference);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
}
