import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import {
  categoriesCollection,
  postTagsCollection,
  postsCollection,
  tagsCollection,
} from "#/db-collections";
import { requireSessionBeforeLoad } from "#/lib/auth-guard";
import { useSpaceAccess } from "#/hooks/useSpaceAccess";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import {
  plainTextFromRichText,
  richTextFromPlainText,
  uploadPostImageRequest,
} from "#/lib/posts/api-client";

export const Route = createFileRoute("/s/$spaceSlug/p/$postId/edit")({
  ssr: false,
  beforeLoad: async () => {
    await requireSessionBeforeLoad("/");
  },
  component: EditPostRoute,
});

function EditPostRoute() {
  const navigate = useNavigate();
  const { spaceSlug, postId } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const {
    space,
    membership: myMembership,
    isAccessPending,
    joinStatus,
    joinError,
    join,
  } = useSpaceAccess({
    normalizedSpaceSlug,
    userId: session?.user.id,
    joinErrorMessage: "Could not verify your membership in this space.",
  });

  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagNames, setNewTagNames] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<Record<string, unknown> | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: postRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ post: postsCollection })
        .where(({ post }) => and(eq(post.id, postId), eq(post.spaceId, space.id)))
        .select(({ post }) => ({
          ...post,
        }));
    },
    [postId, space?.id],
  );
  const post = postRows?.[0];

  const { data: categoryRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ category: categoriesCollection })
        .where(({ category }) => eq(category.spaceId, space.id))
        .select(({ category }) => ({
          ...category,
        }));
    },
    [space?.id],
  );

  const { data: tagRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ tag: tagsCollection })
        .where(({ tag }) => eq(tag.spaceId, space.id))
        .select(({ tag }) => ({
          ...tag,
        }));
    },
    [space?.id],
  );

  const { data: postTagRows } = useLiveQuery(
    (query) => {
      if (!space?.id) {
        return undefined;
      }

      return query
        .from({ postTag: postTagsCollection })
        .where(({ postTag }) => and(eq(postTag.postId, postId), eq(postTag.spaceId, space.id)))
        .select(({ postTag }) => ({
          ...postTag,
        }));
    },
    [postId, space?.id],
  );

  const tagNameSuggestions = useMemo(
    () => new Set((tagRows ?? []).map((tag) => tag.name)),
    [tagRows],
  );
  const isTaxonomyPending = Boolean(space?.id) && (categoryRows === undefined || tagRows === undefined);

  useEffect(() => {
    if (!post || initialized || !postTagRows) {
      return;
    }

    setTitle(post.title);
    setBodyText(plainTextFromRichText(post.bodyRichText));
    setCategoryId(post.categoryId ?? "");
    setImageUrl(post.imageUrl ?? "");
    setImageMeta(post.imageMeta ?? null);
    setSelectedTagIds(postTagRows.map((postTag) => postTag.tagId));
    setInitialized(true);
  }, [initialized, post, postTagRows]);

  const onUploadImage = async (file: File) => {
    setIsUploadingImage(true);
    setError(null);

    try {
      const uploaded = await uploadPostImageRequest(file);
      setImageUrl(uploaded.imageUrl);
      setImageMeta(uploaded.imageMeta);
    } catch {
      setError("Image upload failed. You can still submit with a direct image URL.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.user?.id || !post) {
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedBody = bodyText.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("Title and body are required.");
      return;
    }

    setError(null);
    setIsSaving(true);
    const tagNames = newTagNames
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && !tagNameSuggestions.has(value));

    try {
      const tx = postsCollection.update(
        post.id,
        {
          metadata: {
            source: "user",
            action: "update-post",
            categoryName: categoryId ? null : newCategoryName.trim() || null,
            tagIds: selectedTagIds,
            tagNames,
          },
        },
        (draft) => {
          draft.title = trimmedTitle;
          draft.bodyRichText = richTextFromPlainText(trimmedBody);
          draft.imageUrl = imageUrl || null;
          draft.imageMeta = imageMeta;
          draft.categoryId = categoryId || null;
          draft.updatedAt = new Date().toISOString();
        },
      );

      await tx.isPersisted.promise;

      await navigate({
        to: appRoutes.postById(normalizedSpaceSlug, post.id).to,
        params: appRoutes.postById(normalizedSpaceSlug, post.id).params,
      });
    } catch {
      setError("Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isSessionPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">Loading...</h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            Checking your session.
          </p>
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">
            Sign in required
          </h1>
        </section>
      </main>
    );
  }

  if (joinStatus === "not-found") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">
            Space not found
          </h1>
        </section>
      </main>
    );
  }

  if (isAccessPending && (!space || !myMembership)) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">Loading...</h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            Verifying your membership in this space.
          </p>
        </section>
      </main>
    );
  }

  if (!space || !myMembership) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">Join required</h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            {joinError ?? "Join this space before editing posts."}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={joinStatus === "joining"}
              onClick={() => {
                void join();
              }}
              className="rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {joinStatus === "joining" ? "Joining..." : "Join space"}
            </button>
            <Link
              to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
              params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline"
            >
              Back to space
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">Post not found</h1>
        </section>
      </main>
    );
  }

  if (post.authorId !== session.user.id) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-sea-ink">Edit forbidden</h1>
          <p className="m-0 mt-2 text-sm text-sea-ink-soft">
            Only the post author can edit this thread.
          </p>
          <Link
            to={appRoutes.postById(normalizedSpaceSlug, post.id).to}
            params={appRoutes.postById(normalizedSpaceSlug, post.id).params}
            className="mt-4 inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline"
          >
            Back to thread
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker m-0">Edit Post</p>
        <h1 className="display-title mt-2 text-4xl font-bold text-sea-ink">
          Update your thread
        </h1>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-sea-ink">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-xl border border-chip-line bg-white/80 px-4 text-sm"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-sea-ink">
            Body
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={8}
              className="rounded-xl border border-chip-line bg-white/80 px-4 py-3 text-sm"
            />
          </label>

          <div className="grid gap-2 text-sm font-semibold text-sea-ink">
            <label htmlFor="category">Category</label>
            {isTaxonomyPending ? (
              <p className="m-0 text-xs font-normal text-sea-ink-soft">
                Loading categories and tags...
              </p>
            ) : null}
            <select
              id="category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-11 rounded-xl border border-chip-line bg-white/80 px-3 text-sm"
            >
              <option value="">No category</option>
              {(categoryRows ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            {!categoryId ? (
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Or create a new category (optional)"
                className="h-11 rounded-xl border border-chip-line bg-white/80 px-4 text-sm"
              />
            ) : null}
          </div>

          <div className="grid gap-2 text-sm font-semibold text-sea-ink">
            <span>Tags</span>
            <div className="flex flex-wrap gap-2">
              {(tagRows ?? []).map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((value) => value !== tag.id)
                          : [...current, tag.id],
                      );
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      selected
                        ? "border-sea-ink bg-sea-ink text-white"
                        : "border-chip-line bg-chip-bg text-sea-ink"
                    }`}
                  >
                    #{tag.name}
                  </button>
                );
              })}
            </div>

            <input
              value={newTagNames}
              onChange={(event) => setNewTagNames(event.target.value)}
              placeholder="Add new tags, comma separated"
              className="h-11 rounded-xl border border-chip-line bg-white/80 px-4 text-sm"
            />
          </div>

          <div className="grid gap-2 text-sm font-semibold text-sea-ink">
            <span>Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onUploadImage(file);
                }
              }}
              className="rounded-xl border border-chip-line bg-white/80 px-4 py-3 text-sm"
            />
            {isUploadingImage ? <p className="m-0 text-xs">Uploading image...</p> : null}

            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Or paste image URL"
              className="h-11 rounded-xl border border-chip-line bg-white/80 px-4 text-sm"
            />
          </div>

          {error ? (
            <p className="m-0 text-sm font-semibold text-[color:color-mix(in_srgb,var(--action-primary)_72%,var(--sea-ink))]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving || isUploadingImage}
              className="rounded-full border border-chip-line bg-sea-ink px-5 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>

            <Link
              to={appRoutes.postById(normalizedSpaceSlug, post.id).to}
              params={appRoutes.postById(normalizedSpaceSlug, post.id).params}
              className="inline-flex rounded-full border border-chip-line bg-chip-bg px-4 py-2 text-sm font-semibold text-sea-ink no-underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
