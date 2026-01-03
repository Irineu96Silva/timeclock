import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  geofenceLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  geofenceLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  geofenceRadiusMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxAccuracyMeters?: number;

  @IsOptional()
  @IsBoolean()
  geofenceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  geoRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  qrEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(["GEO_ONLY", "GEO_OR_QR", "QR_ONLY"])
  punchFallbackMode?: "GEO_ONLY" | "GEO_OR_QR" | "QR_ONLY";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  kioskDeviceLabel?: string;
}
