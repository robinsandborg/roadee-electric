import { prepareElectricUrl, proxyElectricRequest } from "#/lib/electric-proxy";

export function isElectricCloudConfigured(): boolean {
  return Boolean(process.env.ELECTRIC_URL);
}

export async function fetchElectricShapeRows(input: {
  request: Request;
  table: string;
  where?: string;
  columns?: string;
}): Promise<unknown> {
  const originUrl = prepareElectricUrl(input.request);
  originUrl.searchParams.set("table", input.table);
  originUrl.searchParams.set("offset", "-1");

  if (input.where) {
    originUrl.searchParams.set("where", input.where);
  }

  if (input.columns) {
    originUrl.searchParams.set("columns", input.columns);
  }

  const response = await proxyElectricRequest(originUrl, input.request);
  return response.json();
}

export async function proxyElectricShapeRequest(input: {
  request: Request;
  table: string;
  where?: string;
  columns?: string;
}): Promise<Response> {
  const originUrl = prepareElectricUrl(input.request);
  originUrl.searchParams.set("table", input.table);

  if (input.where) {
    originUrl.searchParams.set("where", input.where);
  }

  if (input.columns) {
    originUrl.searchParams.set("columns", input.columns);
  }

  return proxyElectricRequest(originUrl, input.request);
}
