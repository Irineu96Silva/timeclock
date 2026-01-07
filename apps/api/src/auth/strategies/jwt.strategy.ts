import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthenticatedUser, JwtPayload, normalizeRole } from "../auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload || !payload.sub || !payload.email || !payload.role) {
      throw new Error("Invalid JWT payload");
    }
    
    return {
      id: payload.sub,
      email: payload.email,
      role: normalizeRole(payload.role),
      companyId: payload.companyId ?? undefined,
    };
  }
}
