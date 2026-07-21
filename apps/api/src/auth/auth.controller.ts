import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthContext } from "./auth.constants.js";

@Controller()
export class AuthController {
  /** Returns the authenticated user, active org and role for the web app. */
  @Get("me")
  me(@CurrentUser() auth: AuthContext): AuthContext {
    return auth;
  }
}
