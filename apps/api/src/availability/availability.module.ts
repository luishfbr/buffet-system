import { Global, Module } from "@nestjs/common";
import { AvailabilityController } from "./availability.controller.js";
import { AvailabilityService } from "./availability.service.js";

/**
 * `@Global` para o `PublicModule` servir o calendário do portal sem importar
 * nada — o cache em memória do RNF-V2-04 tem que ser a **mesma** instância nas
 * duas rotas, senão a escrita invalidaria um cache e o portal leria o outro.
 */
@Global()
@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
