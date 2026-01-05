import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  workStartTime?: string | null;

  @IsOptional()
  @IsString()
  breakStartTime?: string | null;

  @IsOptional()
  @IsString()
  breakEndTime?: string | null;

  @IsOptional()
  @IsString()
  workEndTime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  toleranceMinutes?: number | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;
}
