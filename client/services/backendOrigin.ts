export function backendOrigin(
  configured: string | undefined,
  development: boolean,
  frontendOrigin?: string,
) {
  if (configured) return configured
  if (!frontendOrigin) return 'http://localhost:8000'
  const origin = new URL(frontendOrigin)
  if (development) origin.port = '8000'
  return origin.origin
}
