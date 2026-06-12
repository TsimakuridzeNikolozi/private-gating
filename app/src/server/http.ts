/**
 * Parse a JSON request body, returning null instead of throwing on malformed
 * input so routes can answer 400 rather than surfacing an opaque 500.
 */
export async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
