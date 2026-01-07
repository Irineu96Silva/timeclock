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
import * as ExcelJS from "exceljs";

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
      where: { id: employeeId, companyId: admin.companyId! },
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
        companyId: admin.companyId!,
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

  private buildFilename(name: string, fromLabel: string, toLabel: string, extension: string = "csv") {
    const safeName = name
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    return `pontos_${safeName || "colaborador"}_${fromLabel}_a_${toLabel}.${extension}`;
  }

  async buildEmployeeExcel(
    admin: AuthenticatedUser,
    employeeId: string,
    range: { from?: string; to?: string },
  ) {
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId: admin.companyId! },
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
        companyId: admin.companyId!,
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Pontos");

    // Estilos
    const headerStyle = {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF1f4e8c" },
      },
      alignment: { vertical: "middle" as const, horizontal: "center" as const },
      border: {
        top: { style: "thin" as const },
        bottom: { style: "thin" as const },
        left: { style: "thin" as const },
        right: { style: "thin" as const },
      },
    };

    // Cabeçalho
    worksheet.addRow([
      "Data",
      "Hora",
      "Tipo",
      "Fonte",
      "IP",
      "User Agent",
      "Latitude",
      "Longitude",
      "Distância (m)",
      "Horário Esperado",
      "Diferença (min)",
      "Pontualidade",
    ]);

    // Aplicar estilo ao cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Dados
    events.forEach((event) => {
      const { date, time } = formatDateTimeParts(event.timestamp, timeZone);
      const expectedTime = this.getExpectedTime(event.type, schedule);
      const { deltaMinutes, punctuality } = this.calculatePunctuality(
        event.timestamp,
        expectedTime,
        schedule.toleranceMinutes,
        timeZone,
      );
      const source = event.punchMethod === "QR" ? "QR" : event.source;

      const row = worksheet.addRow([
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
      ]);

      // Colorir pontualidade
      const punctualityCell = row.getCell(12);
      if (punctuality === "NO_HORARIO") {
        punctualityCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF28a745" },
        };
        punctualityCell.font = { color: { argb: "FFFFFFFF" } };
      } else if (punctuality === "ATRASADO") {
        punctualityCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFdc3545" },
        };
        punctualityCell.font = { color: { argb: "FFFFFFFF" } };
      } else if (punctuality === "ADIANTADO") {
        punctualityCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFffc107" },
        };
        punctualityCell.font = { color: { argb: "FF000000" } };
      }
    });

    // Ajustar largura das colunas
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });

    // Adicionar informações do funcionário
    worksheet.insertRow(1, [`Funcionário: ${employee.fullName}`]);
    worksheet.insertRow(2, [`Período: ${fromLabel} a ${toLabel}`]);
    worksheet.insertRow(3, [""]);

    // Mesclar células do cabeçalho de informações
    worksheet.mergeCells(1, 1, 1, 12);
    worksheet.mergeCells(2, 1, 2, 12);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = this.buildFilename(employee.fullName, fromLabel, toLabel, "xlsx");

    return { buffer, filename };
  }

  async buildBulkExcel(
    admin: AuthenticatedUser,
    employeeIds: string[],
    range: { from?: string; to?: string },
  ) {
    const { start, end, fromLabel, toLabel } = this.resolveDateRange(range.from, range.to);

    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        id: { in: employeeIds },
        companyId: admin.companyId!,
      },
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

    if (employees.length === 0) {
      throw new NotFoundException("Nenhum colaborador encontrado");
    }

    const workbook = new ExcelJS.Workbook();

    for (const employee of employees) {
      const events = await this.prisma.timeClockEvent.findMany({
        where: {
          companyId: admin.companyId!,
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
      const worksheet = workbook.addWorksheet(employee.fullName.substring(0, 31)); // Excel limita a 31 caracteres

      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFFFF" } },
        fill: {
          type: "pattern" as const,
          pattern: "solid" as const,
          fgColor: { argb: "FF1f4e8c" },
        },
        alignment: { vertical: "middle" as const, horizontal: "center" as const },
      };

      worksheet.addRow([
        "Data",
        "Hora",
        "Tipo",
        "Fonte",
        "IP",
        "User Agent",
        "Latitude",
        "Longitude",
        "Distância (m)",
        "Horário Esperado",
        "Diferença (min)",
        "Pontualidade",
      ]);

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      events.forEach((event) => {
        const { date, time } = formatDateTimeParts(event.timestamp, timeZone);
        const expectedTime = this.getExpectedTime(event.type, schedule);
        const { deltaMinutes, punctuality } = this.calculatePunctuality(
          event.timestamp,
          expectedTime,
          schedule.toleranceMinutes,
          timeZone,
        );
        const source = event.punchMethod === "QR" ? "QR" : event.source;

        worksheet.addRow([
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
        ]);
      });

      worksheet.columns.forEach((column) => {
        column.width = 15;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `pontos_lote_${fromLabel}_a_${toLabel}.xlsx`;

    return { buffer, filename };
  }
}
