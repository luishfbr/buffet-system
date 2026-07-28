const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    // Send the Better-Auth session cookie across origins.
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data?.message as string) ?? "Erro na requisição",
      data?.errors as Record<string, string[]> | undefined
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

/**
 * Mensagem exibível de qualquer erro capturado (RNF08). Centraliza o
 * `err instanceof ApiError ? err.message : "..."` que estava repetido em toda
 * página, e cobre falha de rede — nela o `fetch` rejeita com `TypeError`, não
 * com `ApiError`, e o usuário via só "Erro na requisição".
 */
export function errorMessage(
  err: unknown,
  fallback = "Algo deu errado. Tente de novo."
): string {
  // String crua = validação local da própria tela (não passou pela API).
  if (typeof err === "string") return err;
  if (err instanceof ApiError) return err.message;
  // Falha de rede rejeita com TypeError, não com ApiError — sem este ramo o
  // usuário offline via "Erro na requisição", que não diz o que fazer.
  if (err instanceof TypeError)
    return "Não foi possível falar com o servidor. Verifique sua conexão.";
  return fallback;
}

/** Erros por campo devolvidos pelo `ZodValidationPipe`; `{}` quando não houver. */
export function fieldErrors(err: unknown): Record<string, string[]> {
  return err instanceof ApiError && err.errors ? err.errors : {};
}

/** Erro de validação (tem mapa por campo) → inline no form; o resto → toast. */
export function isValidationError(err: unknown): boolean {
  return Object.keys(fieldErrors(err)).length > 0;
}
