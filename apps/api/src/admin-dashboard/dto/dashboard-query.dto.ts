import { IsOptional, Matches } from "class-validator";

export class DashboardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Data deve estar no formato AAAA-MM-DD.",
  })
  date?: string;
}
