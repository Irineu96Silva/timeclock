import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function mask(value?: string) {
  if (!value) return "(empty)";
  if (value.length <= 10) return "***";
  return value.slice(0, 6) + "..." + value.slice(-4);
}

function buildPrismaOptions(logger: Logger): any {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  logger.log(`[PrismaService] TURSO_DATABASE_URL exists? ${!!tursoUrl}`);
  logger.log(`[PrismaService] TURSO_AUTH_TOKEN exists? ${!!tursoAuthToken}`);
  logger.log(`[PrismaService] DATABASE_URL = ${process.env.DATABASE_URL ?? "(undefined)"}`);
  logger.log(`[PrismaService] TURSO_DATABASE_URL (masked) = ${mask(tursoUrl)}`);

  if (tursoUrl && tursoAuthToken) {
    logger.log("[PrismaService] ✅ Using Turso adapter (libsql).");

    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });

    const adapter = new PrismaLibSQL(libsql as any);
    return { adapter: adapter as any };
  }

  logger.warn("[PrismaService] ⚠️ Using SQLite (fallback).");
  return {};
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super(buildPrismaOptions(new Logger("PrismaService")));
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("[PrismaService] ✅ Conectado ao banco de dados");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
