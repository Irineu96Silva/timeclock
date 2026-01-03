import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

type DashboardStatus = "WORKING" | "BREAK" | "OUT" | "NOT_STARTED";

type ActiveEmployee = {
  id: string;
  userId: string;
  fullName: string;
  isActive: boolean;
  user: {
    email: string;
    isActive: boolean;
  };
};

type EventSnapshot = {
  employeeId: string;
  type: string;
  timestamp: Date;
  geoStatus: string;
  geoDistanceMeters: number | null;
};

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser, query: DashboardQueryDto) {
    const referenceDate = this.parseReferenceDate(query.date);
    const { start, end } = this.getDayRange(referenceDate);

    const employees = await this.getActiveEmployees(user.companyId);
    const lastEvents = await this.getLastEvents(
      user.companyId,
      employees.map((employee) => employee.id),
      start,
      end,
    );

    const counts = {
      workingNow: 0,
      onBreakNow: 0,
      outNow: 0,
      notStartedYet: 0,
    };

    for (const employee of employees) {
      const lastEvent = lastEvents.get(employee.id);
      const status = this.getStatusNow(lastEvent?.type ?? null);
      switch (status) {
        case "WORKING":
          counts.workingNow += 1;
          break;
        case "BREAK":
          counts.onBreakNow += 1;
          break;
        case "OUT":
          counts.outNow += 1;
          break;
        case "NOT_STARTED":
        default:
          counts.notStartedYet += 1;
          break;
      }
    }

    const blockedAttemptsToday = await this.getBlockedAttemptsTotal(
      user.companyId,
      start,
      end,
    );

    return {
      date: this.formatDate(referenceDate),
      totalActiveEmployees: employees.length,
      ...counts,
      blockedAttemptsToday,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  async getLive(user: AuthenticatedUser, query: DashboardQueryDto) {
    const referenceDate = this.parseReferenceDate(query.date);
    const { start, end } = this.getDayRange(referenceDate);

    const employees = await this.getActiveEmployees(user.companyId);
    const lastEvents = await this.getLastEvents(
      user.companyId,
      employees.map((employee) => employee.id),
      start,
      end,
    );

    const blockedCounts = await this.getBlockedAttemptsByUser(
      user.companyId,
      employees.map((employee) => employee.userId),
      start,
      end,
    );

    return employees.map((employee) => {
      const lastEvent = lastEvents.get(employee.id);
      const lastEventType = lastEvent?.type ?? null;

      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        email: employee.user.email,
        isActive: employee.isActive && employee.user.isActive,
        statusNow: this.getStatusNow(lastEventType),
        lastEventType,
        lastEventTime: lastEvent?.timestamp.toISOString() ?? null,
        geoStatus: lastEvent?.geoStatus ?? null,
        lastDistanceMeters: lastEvent?.geoDistanceMeters ?? null,
        blockedAttemptsToday: blockedCounts.get(employee.userId) ?? 0,
      };
    });
  }

  private parseReferenceDate(date?: string) {
    if (!date) {
      return new Date();
    }

    const [yearText, monthText, dayText] = date.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const reference = new Date(year, month - 1, day);

    if (
      Number.isNaN(reference.getTime()) ||
      reference.getFullYear() !== year ||
      reference.getMonth() !== month - 1 ||
      reference.getDate() !== day
    ) {
      throw new BadRequestException("Data invalida.");
    }

    return reference;
  }

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getDayRange(reference: Date) {
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    const end = new Date(reference);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private getStatusNow(lastType: string | null): DashboardStatus {
    if (!lastType) {
      return "NOT_STARTED";
    }
    if (lastType === "BREAK_START") {
      return "BREAK";
    }
    if (lastType === "OUT") {
      return "OUT";
    }
    if (lastType === "IN" || lastType === "BREAK_END") {
      return "WORKING";
    }
    return "NOT_STARTED";
  }

  private async getActiveEmployees(companyId: string): Promise<ActiveEmployee[]> {
    return this.prisma.employeeProfile.findMany({
      where: {
        companyId,
        isActive: true,
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        isActive: true,
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });
  }

  private async getLastEvents(
    companyId: string,
    employeeIds: string[],
    start: Date,
    end: Date,
  ) {
    if (employeeIds.length === 0) {
      return new Map<string, EventSnapshot>();
    }

    const events = await this.prisma.timeClockEvent.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: "desc" },
      select: {
        employeeId: true,
        type: true,
        timestamp: true,
        geoStatus: true,
        geoDistanceMeters: true,
      },
    });

    const map = new Map<string, EventSnapshot>();
    for (const event of events) {
      if (!map.has(event.employeeId)) {
        map.set(event.employeeId, event);
      }
    }

    return map;
  }

  private async getBlockedAttemptsTotal(companyId: string, start: Date, end: Date) {
    return this.prisma.auditLog.count({
      where: {
        companyId,
        action: "TIMECLOCK_PUNCH_BLOCKED",
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  private async getBlockedAttemptsByUser(
    companyId: string,
    userIds: string[],
    start: Date,
    end: Date,
  ) {
    const counts = new Map<string, number>();
    if (userIds.length === 0) {
      return counts;
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        companyId,
        action: "TIMECLOCK_PUNCH_BLOCKED",
        userId: { in: userIds },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        userId: true,
      },
    });

    for (const log of logs) {
      if (!log.userId) {
        continue;
      }
      counts.set(log.userId, (counts.get(log.userId) ?? 0) + 1);
    }

    return counts;
  }
}
