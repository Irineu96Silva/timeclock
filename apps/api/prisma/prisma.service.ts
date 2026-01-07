import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function buildPrismaOptions(): any {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  // ✅ LOGA no Render ANTES de conectar
  console.log("[PrismaService] TURSO_DATABASE_URL exists?", !!tursoUrl);
  console.log("[PrismaService] TURSO_AUTH_TOKEN exists?", !!tursoAuthToken);
  console.log("[PrismaService] DATABASE_URL =", process.env.DATABASE_URL);

  if (tursoUrl && tursoAuthToken) {
    console.log("[PrismaService] ✅ Using Turso adapter (libsql).");

    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });

    const adapter = new PrismaLibSQL(libsql as any);
    return { adapter: adapter as any };
  }

  console.log("[PrismaService] ⚠️ Using SQLite (fallback).");
  return {};
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(buildPrismaOptions());
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
