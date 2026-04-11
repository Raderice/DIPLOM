function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isFrontendDevPort(port: string): boolean {
  return port === "5173" || port === "4173";
}

export function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configured) {
    const normalized = trimTrailingSlash(configured);

    if (typeof window !== "undefined") {
      try {
        const configuredUrl = new URL(normalized, window.location.origin);
        const configuredIsLoopback = isLoopbackHost(configuredUrl.hostname);
        const currentIsLoopback = isLoopbackHost(window.location.hostname);

        // If app is opened from LAN/public host, ignore localhost API configs.
        if (!currentIsLoopback && configuredIsLoopback) {
          if (isFrontendDevPort(window.location.port)) {
            return `${window.location.protocol}//${window.location.hostname}:4000`;
          }
          return trimTrailingSlash(window.location.origin);
        }
      } catch {
        // Keep configured value if parsing fails.
      }
    }

    return normalized;
  }

  if (typeof window === "undefined") {
    return "http://localhost:4000";
  }

  const { protocol, hostname, origin } = window.location;
  const isLocalhost = isLoopbackHost(hostname);

  if (isLocalhost) {
    return `${protocol}//${hostname}:4000`;
  }

  if (isFrontendDevPort(window.location.port)) {
    return `${protocol}//${hostname}:4000`;
  }

  return trimTrailingSlash(origin);
}
