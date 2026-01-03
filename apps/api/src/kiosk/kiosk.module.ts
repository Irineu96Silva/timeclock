import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { KioskController } from "./kiosk.controller";
import { KioskPunchController } from "./kiosk-punch.controller";
import { KioskPunchService } from "./kiosk-punch.service";
import { KioskService } from "./kiosk.service";

@Module({
  imports: [PrismaModule],
  controllers: [KioskController, KioskPunchController],
  providers: [KioskService, KioskPunchService],
})
export class KioskModule {}
