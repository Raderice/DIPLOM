function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === "undefined") {
    return "http://localhost:4000";
  }

  const { protocol, hostname, origin } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalhost) {
    return `${protocol}//${hostname}:4000`;
  }

  return trimTrailingSlash(origin);
}
