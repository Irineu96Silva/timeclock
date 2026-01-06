import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  formatDateTimeParts,
  getMinutesOfDay,
  isValidTimeString,
  parseTimeToMinutes,
  resolveTimeZone,
} from "../utils/time-utils";

type Punctuality = "ADIANTADO" | "NO_HORARIO" | "ATRASADO" | "";

type ScheduleSnapshot = {
  workStartTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  workEndTime: string | null;
  toleranceMinutes: number | null;
};

@Injectable()
export class AdminExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildEmployeeCsv(
    admin: AuthenticatedUser,
    employeeId: string,
    range: { from?: string; to?: string },
  ) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId: admin.companyId },
      select: {
        id: true,
        fullName: true,
        workStartTime: true,
        breakStartTime: true,
        breakEndTime: true,
        workEndTime: true,
        toleranceMinutes: true,
        timezone: true,
      },
    });

    if (!employee) {
      throw new NotFoundException("Colaborador nao encontrado");
    }

    const { start, end, fromLabel, toLabel } = this.resolveDateRange(range.from, range.to);

    const events = await this.prisma.timeClockEvent.findMany({
      where: {
        companyId: admin.companyId,
        employeeId: employee.id,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: "asc" },
      select: {
        timestamp: true,
        type: true,
        source: true,
        ip: true,
        userAgent: true,
        latitude: true,
        longitude: true,
        geoDistanceMeters: true,
        punchMethod: true,
      },
    });

    const schedule: ScheduleSnapshot = {
      workStartTime: employee.workStartTime ?? null,
      breakStartTime: employee.breakStartTime ?? null,
      breakEndTime: employee.breakEndTime ?? null,
      workEndTime: employee.workEndTime ?? null,
      toleranceMinutes: employee.toleranceMinutes ?? 5,
    };

    const timeZone = resolveTimeZone(employee.timezone);

    const header = [
      "data",
      "hora",
      "tipo",
      "fonte",
      "ip",
      "userAgent",
      "latitude",
      "longitude",
      "distancia",
      "expectedTime",
      "deltaMinutes",
      "punctuality",
    ];

    const rows = events.map((event) => {
      const { date, time } = formatDateTimeParts(event.timestamp, timeZone);

      const expectedTime = this.getExpectedTime(event.type, schedule);

      const { deltaMinutes, punctuality } = this.calculatePunctuality(
        event.timestamp,
        expectedTime,
        schedule.toleranceMinutes,
        timeZone,
      );

      const source = event.punchMethod === "QR" ? "QR" : event.source;

      return [
        date,
        time,
        event.type,
        source,
        event.ip ?? "",
        event.userAgent ?? "",
        event.latitude ?? "",
        event.longitude ?? "",
        event.geoDistanceMeters ?? "",
        expectedTime ?? "",
        deltaMinutes ?? "",
        punctuality,
      ];
    });

    const csv = this.buildCsv([header, ...rows]);
    const filename = this.buildFilename(employee.fullName, fromLabel, toLabel);

    return { csv, filename };
  }

  private resolveDateRange(from?: string, to?: string) {
    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const fromDate = from ? this.parseDate(from) : defaultFrom;
    const toDate = to ? this.parseDate(to) : defaultTo;

    if (fromDate > toDate) {
      throw new BadRequestException("Periodo invalido.");
    }

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      fromLabel: this.formatDate(fromDate),
      toLabel: this.formatDate(toDate),
    };
  }

  private parseDate(value: string) {
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day);

    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new BadRequestException("Data invalida.");
    }

    return date;
  }

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getExpectedTime(type: string, schedule: ScheduleSnapshot) {
    const time =
      type === "IN"
        ? schedule.workStartTime
        : type === "OUT"
          ? schedule.workEndTime
          : type === "BREAK_START"
            ? schedule.breakStartTime
            : type === "BREAK_END"
              ? schedule.breakEndTime
              : null;

    if (!time || !isValidTimeString(time)) {
      return null;
    }

    return time;
  }

  private calculatePunctuality(
    timestamp: Date,
    expectedTime: string | null,
    toleranceMinutes: number | null,
    timeZone?: string,
  ) {
    if (!expectedTime) {
      return { deltaMinutes: null as number | null, punctuality: "" as Punctuality };
    }

    const expectedMinutes = parseTimeToMinutes(expectedTime);
    const actualMinutes = getMinutesOfDay(timestamp, timeZone);
    const deltaMinutes = actualMinutes - expectedMinutes;
    const tolerance = toleranceMinutes ?? 5;

    let punctuality: Punctuality = "";
    if (Math.abs(deltaMinutes) <= tolerance) {
      punctuality = "NO_HORARIO";
    } else if (deltaMinutes > 0) {
      punctuality = "ATRASADO";
    } else {
      punctuality = "ADIANTADO";
    }

    return { deltaMinutes, punctuality };
  }

  private buildCsv(rows: Array<Array<string | number>>) {
    return rows.map((row) => row.map((cell) => this.escapeCsv(cell)).join(",")).join("\n");
  }

  private escapeCsv(value: string | number) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private buildFilename(name: string, fromLabel: string, toLabel: string) {
    const safeName = name
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    return `pontos_${safeName || "colaborador"}_${fromLabel}_a_${toLabel}.csv`;
  }
}
