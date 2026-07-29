import { cn } from "@/lib/utils";
import { errorMessage, fieldErrors } from "@/lib/api";

/**
 * Erro de formulário (RNF08). Renderiza a mensagem **e** o mapa por campo que
 * o `ZodValidationPipe` já devolve em `ApiError.errors` — antes disso, a API
 * dizia exatamente qual campo estava errado e a UI mostrava só "Dados
 * inválidos".
 *
 * `labels` traduz o nome do campo do schema para o rótulo que está na tela
 * (ex.: `pricePerPerson` → "Preço por convidado").
 */
export function FormError({
  error,
  labels,
  className,
}: {
  error: unknown;
  labels?: Record<string, string>;
  className?: string;
}) {
  if (!error) return null;

  const message = errorMessage(error);
  const fields = Object.entries(fieldErrors(error));

  return (
    <div role="alert" className={cn("text-sm text-destructive", className)}>
      <p>{message}</p>
      {fields.length > 0 && (
        <ul className="mt-1 list-inside list-disc">
          {fields.map(([field, messages]) => (
            <li key={field}>
              <span className="font-medium">{labels?.[field] ?? field}:</span>{" "}
              {messages.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
