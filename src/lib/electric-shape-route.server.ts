import { buildScopedWhere, resolveShapeScope } from "#/lib/posts/shape.server";
import { prepareElectricUrl, proxyElectricRequest } from "#/lib/electric-proxy";

export async function serveScopedShapeRoute(input: {
  request: Request;
  table: string;
  scopeColumn: string;
  columns: string;
}): Promise<Response> {
  try {
    const { spaceIds } = await resolveShapeScope(input.request);

    const originUrl = prepareElectricUrl(input.request);
    originUrl.searchParams.set("table", input.table);
    originUrl.searchParams.set("where", buildScopedWhere(input.scopeColumn, spaceIds));
    originUrl.searchParams.set("columns", input.columns);

    return proxyElectricRequest(originUrl, input.request);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return Response.json(
        {
          code: "unauthorized",
          message: "Authentication required.",
        },
        { status: 401 },
      );
    }

    return Response.json(
      {
        code: "shape_proxy_error",
        message: "Could not proxy Electric shape request.",
      },
      { status: 503 },
    );
  }
}
