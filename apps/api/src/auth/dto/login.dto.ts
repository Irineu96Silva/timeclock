import { IsEmail, IsString, MinLength, IsOptional, ValidateIf } from "class-validator";

export class LoginDto {
  @ValidateIf((o) => !o.username)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  username?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  companyId?: string; // Para login multi-tenant
}
