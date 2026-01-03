import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

class GeoDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsNumber()
  @Min(0)
  accuracy!: number;

  @IsDateString()
  capturedAt!: string;
}

class QrDto {
  @IsString()
  token!: string;
}

export class PunchDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoDto)
  geo?: GeoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QrDto)
  qr?: QrDto;
}
