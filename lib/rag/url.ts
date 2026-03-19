const TRACKING_QUERY_PARAMS = new Set([
  "utm_campaign",
  "utm_content",
  "utm_id",
  "utm_medium",
  "utm_source",
  "utm_term",
  "fbclid",
  "gclid",
  "ref",
]);

function cleanPathname(pathname: string) {
  const normalized = pathname.replace(/\/{2,}/g, "/");
  if (normalized === "/") {
    return "/";
  }

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function stripDefaultPort(url: URL) {
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
}

function sortSearchParams(url: URL) {
  const entries = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_QUERY_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  url.search = "";
  for (const [key, value] of entries) {
    url.searchParams.append(key, value);
  }
}

export function normalizeSubmittedUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  url.hash = "";
  url.pathname = cleanPathname(url.pathname || "/");
  stripDefaultPort(url);
  sortSearchParams(url);

  return url;
}

export function normalizeCrawlUrl(rawUrl: string, baseUrl?: string) {
  try {
    const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";
    url.pathname = cleanPathname(url.pathname || "/");
    stripDefaultPort(url);
    sortSearchParams(url);

    return url.toString();
  } catch {
    return null;
  }
}

export function isSameOriginUrl(candidateUrl: string, origin: string) {
  try {
    return new URL(candidateUrl).origin === origin;
  } catch {
    return false;
  }
}

export function urlPathname(url: string) {
  const pathname = new URL(url).pathname;
  return pathname === "" ? "/" : pathname;
}
