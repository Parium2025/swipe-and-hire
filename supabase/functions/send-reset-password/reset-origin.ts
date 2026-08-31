export const PRODUCTION_RESET_APP_ORIGIN = "https://www.parium.se";

interface ResetOriginOptions {
  deploymentEnv?: string | null;
  configuredOrigin?: string | null;
}

export function resolveResetAppOrigin(
  options: ResetOriginOptions = {},
): string | null {
  // A missing or unknown server environment is ambiguous, so reset delivery
  // fails closed instead of silently choosing a potentially wrong frontend.
  const deploymentEnv = options.deploymentEnv?.trim().toLowerCase();

  if (deploymentEnv === "production") {
    return PRODUCTION_RESET_APP_ORIGIN;
  }

  if (deploymentEnv !== "preview" && deploymentEnv !== "staging") {
    return null;
  }

  if (!options.configuredOrigin) return null;

  try {
    const url = new URL(options.configuredOrigin);
    const isExactOrigin = url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash;
    if (!isExactOrigin) return null;

    if (deploymentEnv === "preview") {
      if (!url.hostname.endsWith(".lovable.app")) return null;
    } else if (url.hostname !== "staging.parium.se") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}
