import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { KioskAuthController } from "./kiosk-auth.controller";
import { KioskAuthService } from "./kiosk-auth.service";

@Module({
  imports: [PrismaModule],
  controllers: [KioskAuthController],
  providers: [KioskAuthService],
})
export class KioskAuthModule {}
