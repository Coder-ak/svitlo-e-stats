export function resolveApiEndpoint(path?: string) {
  const base = import.meta.env.VITE_API_URL?.trim();
  if (!path) {
    return base || "";
  }
  if (path.startsWith("http")) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (import.meta.env.DEV) {
    return normalizedPath;
  }
  if (base) {
    const baseTrimmed = base.replace(/\/$/, "");
    return `${baseTrimmed}${normalizedPath}`;
  }
  return normalizedPath;
}
