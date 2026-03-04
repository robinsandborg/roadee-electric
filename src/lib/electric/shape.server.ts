type ElectricShapeEvent = {
  key?: string;
  value?: Record<string, unknown>;
  headers?: Record<string, unknown>;
};

const SHAPE_PROTOCOL_MARKER_QUERY_PARAMS = [
  "offset",
  "handle",
  "live",
  "live_sse",
  "experimental_live_sse",
  "cursor",
  "expired_handle",
  "log",
  "cache-buster",
  "subset__where",
  "subset__limit",
  "subset__offset",
  "subset__order_by",
  "subset__params",
  "subset__where_expr",
  "subset__order_by_expr",
] as const;
const SHAPE_PROTOCOL_PASSTHROUGH_QUERY_PARAMS = [
  "handle",
  "live",
  "live_sse",
  "experimental_live_sse",
  "cursor",
  "expired_handle",
  "log",
  "cache-buster",
  "subset__where",
  "subset__limit",
  "subset__offset",
  "subset__order_by",
  "subset__params",
  "subset__where_expr",
  "subset__order_by_expr",
] as const;
const PROXY_RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "electric-cursor",
  "electric-handle",
  "electric-offset",
  "etag",
  "vary",
] as const;

export function isElectricCloudConfigured(): boolean {
  return Boolean(
    process.env.ELECTRIC_URL && process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SECRET,
  );
}

export async function fetchElectricShapeRows(input: {
  table: string;
  where?: string;
}): Promise<Record<string, unknown>[]> {
  const electricUrl = process.env.ELECTRIC_URL;
  const sourceId = process.env.ELECTRIC_SOURCE_ID;
  const secret = process.env.ELECTRIC_SECRET;

  if (!electricUrl || !sourceId || !secret) {
    throw new Error("Electric Cloud env is not fully configured.");
  }

  const url = new URL("/v1/shape", electricUrl);
  url.searchParams.set("source_id", sourceId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("table", input.table);
  url.searchParams.set("offset", "-1");
  if (input.where) {
    url.searchParams.set("where", input.where);
  }

  const response = await fetch(url);
  const payload = (await safeJson(response)) as
    | ElectricShapeEvent[]
    | { message?: string; errors?: unknown };

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : "Electric shape request failed.";
    throw new Error(message);
  }

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((event) => event && typeof event === "object" && event.value)
    .map((event) => event.value ?? {});
}

export function isElectricShapeProtocolRequest(request: Request): boolean {
  const url = new URL(request.url);
  return SHAPE_PROTOCOL_MARKER_QUERY_PARAMS.some((param) => url.searchParams.has(param));
}

export async function proxyElectricShapeRequest(input: {
  request: Request;
  table: string;
  where?: string;
  columns?: string;
}): Promise<Response> {
  const electricUrl = process.env.ELECTRIC_URL;
  const sourceId = process.env.ELECTRIC_SOURCE_ID;
  const secret = process.env.ELECTRIC_SECRET;

  if (!electricUrl || !sourceId || !secret) {
    throw new Error("Electric Cloud env is not fully configured.");
  }

  const requestUrl = new URL(input.request.url);
  const electricShapeUrl = new URL("/v1/shape", electricUrl);
  electricShapeUrl.searchParams.set("source_id", sourceId);
  electricShapeUrl.searchParams.set("secret", secret);
  electricShapeUrl.searchParams.set("table", input.table);
  electricShapeUrl.searchParams.set("offset", requestUrl.searchParams.get("offset") ?? "-1");
  electricShapeUrl.searchParams.set("replica", "full");

  if (input.where) {
    electricShapeUrl.searchParams.set("where", input.where);
  }

  if (input.columns) {
    electricShapeUrl.searchParams.set("columns", input.columns);
  }

  for (const param of SHAPE_PROTOCOL_PASSTHROUGH_QUERY_PARAMS) {
    if (!requestUrl.searchParams.has(param)) {
      continue;
    }

    // Preserve explicit empty protocol values such as `cursor=`.
    electricShapeUrl.searchParams.set(param, requestUrl.searchParams.get(param) ?? "");
  }

  const accept = input.request.headers.get("accept");
  const response = await fetch(electricShapeUrl, {
    headers: accept ? { accept } : undefined,
  });

  const headers = new Headers();
  for (const name of PROXY_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  // Electric clients require protocol headers such as `electric-schema`.
  // Forward all `electric-*` headers from upstream to avoid brittle allowlists.
  for (const [name, value] of response.headers.entries()) {
    if (name.toLowerCase().startsWith("electric-")) {
      headers.set(name, value);
    }
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
