import { Global, Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller.js";
import { UploadsService } from "./uploads.service.js";

// @Global: `assertOwnedAssetUrl` é usado por qualquer módulo que grave URL de
// imagem (page-settings, packages), sem precisar reimportar o módulo.
@Global()
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
