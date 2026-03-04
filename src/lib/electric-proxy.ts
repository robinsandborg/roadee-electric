import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client";

function getElectricUrl(): string {
  return process.env.ELECTRIC_URL || "http://localhost:30000";
}

export function prepareElectricUrl(request: Request): URL {
  const requestUrl = new URL(request.url);
  const originUrl = new URL("/v1/shape", getElectricUrl());

  requestUrl.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value);
    }
  });

  if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET) {
    originUrl.searchParams.set("source_id", process.env.ELECTRIC_SOURCE_ID);
    originUrl.searchParams.set("secret", process.env.ELECTRIC_SECRET);
  }

  return originUrl;
}

export async function proxyElectricRequest(originUrl: URL, request: Request): Promise<Response> {
  const headers: HeadersInit = {};
  const accept = request.headers.get("accept");
  if (accept) {
    headers.accept = accept;
  }

  const response = await fetch(originUrl, {
    headers,
    signal: request.signal,
  });

  const proxyHeaders = new Headers(response.headers);
  proxyHeaders.delete("content-encoding");
  proxyHeaders.delete("content-length");
  proxyHeaders.set("vary", "cookie");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: proxyHeaders,
  });
}
