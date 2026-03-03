type ElectricShapeEvent = {
  key?: string;
  value?: Record<string, unknown>;
  headers?: Record<string, unknown>;
};

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
