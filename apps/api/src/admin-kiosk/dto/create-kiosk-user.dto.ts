import { IsEmail, IsOptional } from "class-validator";

export class CreateKioskUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
