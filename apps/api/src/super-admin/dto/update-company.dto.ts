import { IsEmail, IsOptional, IsString, IsBoolean, ValidateIf } from "class-validator";

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @ValidateIf((o) => o.email !== null && o.email !== undefined && o.email !== "")
  @IsEmail({}, { message: "email must be an email" })
  @IsOptional()
  email?: string | null;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


