import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function buildPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  // Se tiver Turso env, conecta no Turso via Driver Adapter
  if (tursoUrl && tursoAuthToken) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });

    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  // Caso contrário, usa SQLite local via DATABASE_URL=file:...
  return new PrismaClient();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(buildPrismaClient() as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
