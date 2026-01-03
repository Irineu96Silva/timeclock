import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TimeClockController } from "./timeclock.controller";
import { TimeClockService } from "./timeclock.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TimeClockController],
  providers: [TimeClockService],
})
export class TimeClockModule {}
