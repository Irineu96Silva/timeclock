import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminKioskController } from "./admin-kiosk.controller";
import { AdminKioskService } from "./admin-kiosk.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminKioskController],
  providers: [AdminKioskService],
})
export class AdminKioskModule {}
