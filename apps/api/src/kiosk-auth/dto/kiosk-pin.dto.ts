import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class KioskPinDto {
  @Matches(/^\d{4}$/, {
    message: "PIN deve conter exatamente 4 digitos.",
  })
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}
