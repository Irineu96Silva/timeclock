import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

    // ✅ Se tiver Turso env, usa Turso via Adapter
    if (tursoUrl && tursoAuthToken) {
      const libsql = createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      });

      // Prisma 5.22 + adapter-libsql às vezes não bate 100% no type DriverAdapter
      // então usamos "as any" aqui (runtime funciona).
      const adapter = new PrismaLibSQL(libsql as any);

      super({ adapter: adapter as any } as any);

      // log pra você ver no Render qual modo ele escolheu
      this.logger.log("✅ Prisma conectado via Turso (libsql adapter).");
      return;
    }

    // ✅ fallback: SQLite local (DEV)
    super();
    this.logger.warn("⚠️ Prisma usando SQLite local (DATABASE_URL).");
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
