import { IsOptional, IsString } from "class-validator";

export class ExportEmployeeQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
