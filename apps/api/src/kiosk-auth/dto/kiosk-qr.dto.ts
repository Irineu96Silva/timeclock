import { IsOptional, IsString, MaxLength } from "class-validator";

export class KioskQrDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}
