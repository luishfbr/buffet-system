import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Validates/parses a request payload against a Zod schema (from @buffet/shared).
 * Use as `@Body(new ZodValidationPipe(schema))`.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Dados inválidos",
        errors: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
