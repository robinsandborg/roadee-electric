import { TRPCClientError } from "@trpc/client";
import type { Membership, Space } from "#/db-collections";
import { trpc } from "#/lib/trpc-client";

export class SpacesApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "SpacesApiError";
    this.status = status;
    this.code = code;
  }
}

const joinRequestInFlight = new Map<
  string,
  Promise<{
    space: Space;
    membership: Membership;
    created: boolean;
    txid: number | null;
  }>
>();

export async function createSpaceRequest(input: {
  id: string;
  ownerMembershipId: string;
  name: string;
  slug: string;
  description: string;
}): Promise<{
  space: Space;
  ownerMembership: Membership;
  txid: number;
}> {
  try {
    return await trpc.spaces.create.mutate(input);
  } catch (error) {
    throw mapTrpcError(error);
  }
}

export async function joinSpaceBySlugRequest(input: {
  membershipId: string;
  spaceSlug: string;
}): Promise<{
  space: Space;
  membership: Membership;
  created: boolean;
  txid: number | null;
}> {
  const key = input.spaceSlug.trim().toLowerCase();
  const inFlight = joinRequestInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = trpc.spaces.join
    .mutate(input)
    .catch((error: unknown) => {
      throw mapTrpcError(error);
    })
    .finally(() => {
      joinRequestInFlight.delete(key);
    });

  joinRequestInFlight.set(key, request);
  return request;
}

export async function promoteMemberToStaffRequest(input: {
  spaceSlug: string;
  targetUserId: string;
}): Promise<{
  membership: Membership;
  txid: number;
}> {
  try {
    return await trpc.spaces.promote.mutate(input);
  } catch (error) {
    throw mapTrpcError(error);
  }
}

function mapTrpcError(error: unknown): SpacesApiError {
  if (!(error instanceof TRPCClientError)) {
    return new SpacesApiError("Request failed", 500, "request_failed");
  }

  const data = error.data as { code?: string; httpStatus?: number } | undefined;
  const code = normalizeTrpcCode(data?.code);
  const status = typeof data?.httpStatus === "number" ? data.httpStatus : trpcCodeToStatus(code);
  return new SpacesApiError(error.message, status, code);
}

function normalizeTrpcCode(code: string | undefined): string {
  if (!code) {
    return "request_failed";
  }

  if (code.startsWith("FORBIDDEN")) {
    return "forbidden";
  }
  if (code.startsWith("UNAUTHORIZED")) {
    return "unauthorized";
  }
  if (code.startsWith("NOT_FOUND")) {
    return "not_found";
  }
  if (code.startsWith("CONFLICT")) {
    return "slug_conflict";
  }
  if (code.startsWith("BAD_REQUEST")) {
    return "invalid_input";
  }

  return code.toLowerCase();
}

function trpcCodeToStatus(code: string): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "unauthorized":
      return 401;
    case "not_found":
      return 404;
    case "slug_conflict":
      return 409;
    case "invalid_input":
      return 400;
    default:
      return 500;
  }
}
