import { Matches } from "class-validator";

export class SetEmployeePinDto {
  @Matches(/^\d{4}$/, {
    message: "PIN deve conter exatamente 4 digitos.",
  })
  pin!: string;
}
