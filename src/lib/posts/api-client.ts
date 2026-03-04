import { TRPCClientError } from "@trpc/client";
import type { Comment, Post, PostTag, PostUpvote } from "#/db-collections";
import { trpc } from "#/lib/trpc-client";

export class PostsApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PostsApiError";
    this.status = status;
    this.code = code;
  }
}

export async function createPostRequest(input: {
  id: string;
  spaceSlug: string;
  title: string;
  bodyRichText: Record<string, unknown>;
  imageUrl?: string | null;
  imageMeta?: Record<string, unknown> | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tagIds?: string[];
  tagNames?: string[];
}): Promise<{
  post: Post;
  postTags: PostTag[];
  txid: number;
}> {
  try {
    return await trpc.posts.create.mutate(input);
  } catch (error) {
    throw mapTrpcError(error);
  }
}

export async function updateOwnPostRequest(input: {
  postId: string;
  title: string;
  bodyRichText: Record<string, unknown>;
  imageUrl?: string | null;
  imageMeta?: Record<string, unknown> | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tagIds?: string[];
  tagNames?: string[];
}): Promise<{
  post: Post;
  postTags: PostTag[];
  txid: number;
}> {
  try {
    return await trpc.posts.update.mutate({
      postId: input.postId,
      title: input.title,
      bodyRichText: input.bodyRichText,
      imageUrl: input.imageUrl,
      imageMeta: input.imageMeta,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      tagIds: input.tagIds,
      tagNames: input.tagNames,
    });
  } catch (error) {
    throw mapTrpcError(error);
  }
}

export async function createCommentRequest(input: {
  id: string;
  postId: string;
  bodyRichText: Record<string, unknown>;
}): Promise<{ comment: Comment; txid: number }> {
  try {
    return await trpc.posts.createComment.mutate({
      id: input.id,
      postId: input.postId,
      bodyRichText: input.bodyRichText,
    });
  } catch (error) {
    throw mapTrpcError(error);
  }
}

export async function toggleUpvoteRequest(input: {
  id?: string;
  postId: string;
}): Promise<{ upvoted: boolean; upvote: PostUpvote | null; txid: number }> {
  try {
    return await trpc.posts.toggleUpvote.mutate({
      id: input.id,
      postId: input.postId,
    });
  } catch (error) {
    throw mapTrpcError(error);
  }
}

export async function uploadPostImageRequest(file: File): Promise<{
  imageUrl: string;
  imageMeta: Record<string, unknown>;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads/image", {
    method: "POST",
    body: formData,
  });

  const payload = (await safeJson(response)) as {
    code?: string;
    message?: string;
    imageUrl?: string;
    imageMeta?: Record<string, unknown>;
  };

  if (!response.ok || !payload.imageUrl || !payload.imageMeta) {
    throw new PostsApiError(
      payload.message ?? "Upload failed",
      response.status,
      payload.code ?? "upload_failed",
    );
  }

  return {
    imageUrl: payload.imageUrl,
    imageMeta: payload.imageMeta,
  };
}

export function richTextFromPlainText(text: string): Record<string, unknown> {
  const normalizedText = text.trim();
  return {
    type: "doc",
    version: 1,
    text: normalizedText,
  };
}

export function plainTextFromRichText(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }

  const text = (value as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function mapTrpcError(error: unknown): PostsApiError {
  if (!(error instanceof TRPCClientError)) {
    return new PostsApiError("Request failed", 500, "request_failed");
  }

  const data = error.data as { code?: string; httpStatus?: number } | undefined;
  const code = normalizeTrpcCode(data?.code);
  const status = typeof data?.httpStatus === "number" ? data.httpStatus : trpcCodeToStatus(code);
  return new PostsApiError(error.message, status, code);
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
    return "conflict";
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
    case "conflict":
      return 409;
    case "invalid_input":
      return 422;
    default:
      return 500;
  }
}
