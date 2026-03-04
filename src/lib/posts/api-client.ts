import type { Comment, Post, PostTag, PostUpvote } from "#/db-collections";
import type { PostThread, PostsSnapshot } from "#/lib/posts/types";

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
  return requestJson("/api/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchPostThread(postId: string): Promise<PostThread> {
  return requestJson(`/api/posts/${encodeURIComponent(postId)}`, {
    method: "GET",
  });
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
  return requestJson(`/api/posts/${encodeURIComponent(input.postId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: input.title,
      bodyRichText: input.bodyRichText,
      imageUrl: input.imageUrl,
      imageMeta: input.imageMeta,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      tagIds: input.tagIds,
      tagNames: input.tagNames,
    }),
  });
}

export async function createCommentRequest(input: {
  id: string;
  postId: string;
  bodyRichText: Record<string, unknown>;
}): Promise<{ comment: Comment; txid: number }> {
  return requestJson(`/api/posts/${encodeURIComponent(input.postId)}/comments`, {
    method: "POST",
    body: JSON.stringify({
      id: input.id,
      bodyRichText: input.bodyRichText,
    }),
  });
}

export async function toggleUpvoteRequest(input: {
  id?: string;
  postId: string;
}): Promise<{ upvoted: boolean; upvote: PostUpvote | null; txid: number }> {
  return requestJson(`/api/posts/${encodeURIComponent(input.postId)}/upvote`, {
    method: "POST",
    body: JSON.stringify({
      id: input.id,
    }),
  });
}

export async function fetchTaxonomyRequest(spaceSlug: string): Promise<{
  spaceId: string;
  categories: PostsSnapshot["categories"];
  tags: PostsSnapshot["tags"];
}> {
  return requestJson(`/api/posts/taxonomy?spaceSlug=${encodeURIComponent(spaceSlug)}`, {
    method: "GET",
  });
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

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = (await safeJson(response)) as { code?: string; message?: string } & T;
  if (!response.ok) {
    throw new PostsApiError(
      payload.message ?? "Request failed",
      response.status,
      payload.code ?? "request_failed",
    );
  }

  return payload;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
