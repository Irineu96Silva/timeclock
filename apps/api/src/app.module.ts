import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { AdminDashboardModule } from "./admin-dashboard/admin-dashboard.module";
import { AdminKioskModule } from "./admin-kiosk/admin-kiosk.module";
import { AdminSettingsModule } from "./admin-settings/admin-settings.module";
import { EmployeesModule } from "./employees/employees.module";
import { KioskAuthModule } from "./kiosk-auth/kiosk-auth.module";
import { KioskModule } from "./kiosk/kiosk.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TimeClockModule } from "./timeclock/timeclock.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
  {
    ttl: 60_000,
    limit: 20,
  },
]),

    PrismaModule,
    AuthModule,
    AdminDashboardModule,
    AdminKioskModule,
    AdminSettingsModule,
    EmployeesModule,
    KioskAuthModule,
    KioskModule,
    TimeClockModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
