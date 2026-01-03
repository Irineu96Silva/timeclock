import { IsIn, IsOptional, IsString } from "class-validator";

export class KioskPunchDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @IsIn(["PIN", "EMPLOYEE_QR"])
  method!: "PIN" | "EMPLOYEE_QR";

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}
