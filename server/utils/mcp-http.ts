import { createError } from "nuxt/server";

export function validateMcpRequest(
  request: Request,
  config: { siteUrl: string; allowedOrigins: string; deploymentUrl?: string },
) {
  const url = new URL(request.url);
  const site = new URL(config.siteUrl);
  const allowedHosts = new Set([site.host]);
  const origins = new Set([site.origin]);
  if (config.deploymentUrl) {
    const deployment = new URL(`https://${config.deploymentUrl}`);
    allowedHosts.add(deployment.host);
    origins.add(deployment.origin);
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!loopback && !allowedHosts.has(url.host))
    throw createError({
      statusCode: 403,
      statusMessage: "MCP host is not allowed",
    });
  if (loopback) origins.add(url.origin);
  for (const value of config.allowedOrigins
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean))
    origins.add(value);
  const origin = request.headers.get("origin");
  if (origin && !origins.has(origin))
    throw createError({
      statusCode: 403,
      statusMessage: "MCP origin is not allowed",
    });
  return origin;
}
