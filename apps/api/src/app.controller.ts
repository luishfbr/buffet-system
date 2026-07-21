import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/auth.constants.js";

@Controller()
export class AppController {
  @Public()
  @Get("health")
  health() {
    return { status: "ok", service: "buffet-api", ts: new Date().toISOString() };
  }
}
