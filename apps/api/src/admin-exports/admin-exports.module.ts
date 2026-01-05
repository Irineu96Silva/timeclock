import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminExportsController } from "./admin-exports.controller";
import { AdminExportsService } from "./admin-exports.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminExportsController],
  providers: [AdminExportsService],
})
export class AdminExportsModule {}
