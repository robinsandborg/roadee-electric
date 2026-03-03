import { describe, expect, it, vi } from "vitest";
import { createPostsService, PostsServiceError } from "#/lib/posts/service";
import type { PostsRepository } from "#/lib/posts/service";

function makeRepository(overrides: Partial<PostsRepository> = {}): PostsRepository {
  return {
    createPost: async () => ({
      post: {
        id: "post-1",
        spaceId: "space-1",
        authorId: "user-1",
        title: "Title",
        bodyRichText: { type: "doc", text: "Body" },
        imageUrl: null,
        imageMeta: null,
        categoryId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      postTags: [],
    }),
    updateOwnPost: async () => ({
      post: {
        id: "post-1",
        spaceId: "space-1",
        authorId: "user-1",
        title: "Title",
        bodyRichText: { type: "doc", text: "Body" },
        imageUrl: null,
        imageMeta: null,
        categoryId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      postTags: [],
    }),
    createComment: async () => ({
      comment: {
        id: "comment-1",
        postId: "post-1",
        spaceId: "space-1",
        authorId: "user-1",
        bodyRichText: { type: "doc", text: "Body" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
    toggleUpvote: async () => ({
      upvoted: true,
      upvote: {
        id: "upvote-1",
        postId: "post-1",
        spaceId: "space-1",
        userId: "user-1",
        createdAt: new Date().toISOString(),
      },
    }),
    listFeedBySpace: async () => ({
      spaceId: "space-1",
      feed: [],
    }),
    getPostThreadById: async () => ({
      item: {
        post: {
          id: "post-1",
          spaceId: "space-1",
          authorId: "user-1",
          title: "Title",
          bodyRichText: { type: "doc", text: "Body" },
          imageUrl: null,
          imageMeta: null,
          categoryId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        category: null,
        tags: [],
        upvoteCount: 0,
        commentCount: 0,
        hasUpvoted: false,
      },
      comments: [],
    }),
    listTaxonomyBySpace: async () => ({
      spaceId: "space-1",
      categories: [],
      tags: [],
    }),
    listSnapshotBySpace: async () => ({
      spaceId: "space-1",
      snapshot: {
        posts: [],
        comments: [],
        postUpvotes: [],
        categories: [],
        tags: [],
        postTags: [],
      },
    }),
    ...overrides,
  };
}

describe("createPostsService", () => {
  it("rejects empty post title", async () => {
    const service = createPostsService(makeRepository());

    await expect(
      service.createPost({
        spaceSlug: "acme",
        actorUserId: "user-1",
        title: "   ",
        bodyRichText: { type: "doc", text: "Body" },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("deduplicates tag ids and names before repository call", async () => {
    const createPost = vi.fn(makeRepository().createPost);
    const service = createPostsService(
      makeRepository({
        createPost,
      }),
    );

    await service.createPost({
      spaceSlug: "acme",
      actorUserId: "user-1",
      title: "Post",
      bodyRichText: { type: "doc", text: "Body" },
      tagIds: ["tag-1", "tag-1", "tag-2"],
      tagNames: ["a", "a", "b", "  ", "b"],
    });

    expect(createPost).toHaveBeenCalledTimes(1);
    expect(createPost.mock.calls[0]?.[0].tagIds).toEqual(["tag-1", "tag-2"]);
    expect(createPost.mock.calls[0]?.[0].tagNames).toEqual(["a", "b"]);
  });

  it("maps empty spaceSlug to invalid_input for listFeedBySpace", async () => {
    const service = createPostsService(makeRepository());

    await expect(
      service.listFeedBySpace({
        spaceSlug: " ",
        actorUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("preserves forbidden errors from repository updateOwnPost", async () => {
    const service = createPostsService(
      makeRepository({
        updateOwnPost: async () => {
          throw new PostsServiceError("forbidden", "Only the post author can edit this post.");
        },
      }),
    );

    await expect(
      service.updateOwnPost({
        postId: "post-1",
        actorUserId: "user-2",
        title: "Edited",
        bodyRichText: { type: "doc", text: "Body" },
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});
