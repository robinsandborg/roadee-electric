import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { and, eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import {
  categoriesCollection,
  membershipsCollection,
  postsCollection,
  spacesCollection,
  tagsCollection,
  upsertMembership,
  upsertSpace,
} from "#/db-collections";
import { authClient } from "#/lib/auth-client";
import { appRoutes } from "#/lib/routes";
import {
  richTextFromPlainText,
  uploadPostImageRequest,
} from "#/lib/posts/api-client";
import { joinSpaceBySlugRequest, SpacesApiError } from "#/lib/spaces/api-client";

export const Route = createFileRoute("/s/$spaceSlug/new")({
  component: NewPostRoute,
});

function NewPostRoute() {
  const navigate = useNavigate();
  const { spaceSlug } = Route.useParams();
  const normalizedSpaceSlug = spaceSlug.trim().toLowerCase();
  const { data: session, isPending } = authClient.useSession();

  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "ready" | "not-found">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagNames, setNewTagNames] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<Record<string, unknown> | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: spaceRows } = useLiveQuery(
    (query) =>
      query
        .from({ space: spacesCollection })
        .where(({ space }) => eq(space.slug, normalizedSpaceSlug))
        .select(({ space }) => ({
          ...space,
        })),
    [normalizedSpaceSlug],
  );
  const space = spaceRows?.[0];

  const { data: myMembershipRows } = useLiveQuery(
    (query) => {
      if (!space?.id || !session?.user?.id) {
        return undefined;
      }

      return query
        .from({ membership: membershipsCollection })
        .where(({ membership }) =>
          and(eq(membership.spaceId, space.id), eq(membership.userId, session.user.id)),
        )
        .select(({ membership }) => ({
          ...membership,
        }));
    },
    [space?.id, session?.user?.id],
  );

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

  const tagNameSuggestions = useMemo(
    () => new Set((tagRows ?? []).map((tag) => tag.name)),
    [tagRows],
  );

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    let cancelled = false;
    setJoinStatus("joining");
    setJoinError(null);

    const run = async () => {
      try {
        const result = await joinSpaceBySlugRequest({
          membershipId: crypto.randomUUID(),
          spaceSlug: normalizedSpaceSlug,
        });

        if (cancelled) {
          return;
        }

        upsertSpace(result.space);
        upsertMembership(result.membership);
        setJoinStatus("ready");
      } catch (unknownError) {
        if (cancelled) {
          return;
        }

        if (unknownError instanceof SpacesApiError && unknownError.status === 404) {
          setJoinStatus("not-found");
          return;
        }

        setJoinError("Could not verify your membership in this space.");
        setJoinStatus("idle");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [normalizedSpaceSlug, session?.user?.id]);

  const myMembership = myMembershipRows?.[0];

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.user?.id || !space?.id) {
      setError("You must be signed in and joined to create posts.");
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

    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tagNames = newTagNames
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && !tagNameSuggestions.has(value));

    try {
      const tx = postsCollection.insert(
        {
          id: postId,
          spaceId: space.id,
          authorId: session.user.id,
          title: trimmedTitle,
          bodyRichText: richTextFromPlainText(trimmedBody),
          imageUrl: imageUrl || null,
          imageMeta,
          categoryId: categoryId || null,
          createdAt: now,
          updatedAt: now,
        },
        {
          metadata: {
            source: "user",
            action: "create-post",
            spaceSlug: normalizedSpaceSlug,
            categoryName: categoryId ? null : newCategoryName.trim() || null,
            tagIds: selectedTagIds,
            tagNames,
          },
        },
      );

      await tx.isPersisted.promise;

      await navigate({
        to: appRoutes.postById(normalizedSpaceSlug, postId).to,
        params: appRoutes.postById(normalizedSpaceSlug, postId).params,
      });
    } catch {
      setError("Could not create post. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

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

  if (isPending) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">Loading...</h1>
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">
            Sign in required
          </h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            You need to authenticate before creating a post.
          </p>
        </section>
      </main>
    );
  }

  if (joinStatus === "not-found") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">
            Space not found
          </h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            No space exists for <code>{normalizedSpaceSlug}</code>.
          </p>
        </section>
      </main>
    );
  }

  if (!space || !myMembership || joinStatus !== "ready") {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <h1 className="display-title text-4xl font-bold text-[var(--sea-ink)]">
            Preparing editor...
          </h1>
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            {joinError ?? "Checking membership and loading space data."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker m-0">New Post</p>
        <h1 className="display-title mt-2 text-4xl font-bold text-[var(--sea-ink)]">
          Create a thread
        </h1>
        <p className="m-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
          Share context, attach an image, and tag the right topic.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-[var(--sea-ink)]">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What should we improve?"
              className="h-11 rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 text-sm text-[var(--sea-ink)] outline-none"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[var(--sea-ink)]">
            Body
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={8}
              placeholder="Describe the request, impact, and examples."
              className="rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 py-3 text-sm text-[var(--sea-ink)] outline-none"
            />
          </label>

          <div className="grid gap-2 text-sm font-semibold text-[var(--sea-ink)]">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-11 rounded-xl border border-[var(--chip-line)] bg-white/80 px-3 text-sm"
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
                className="h-11 rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 text-sm"
              />
            ) : null}
          </div>

          <div className="grid gap-2 text-sm font-semibold text-[var(--sea-ink)]">
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
                        ? "border-[var(--sea-ink)] bg-[var(--sea-ink)] text-white"
                        : "border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]"
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
              className="h-11 rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 text-sm"
            />
          </div>

          <div className="grid gap-2 text-sm font-semibold text-[var(--sea-ink)]">
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
              className="rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 py-3 text-sm"
            />
            {isUploadingImage ? <p className="m-0 text-xs">Uploading image...</p> : null}

            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Or paste image URL"
              className="h-11 rounded-xl border border-[var(--chip-line)] bg-white/80 px-4 text-sm"
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
              className="rounded-full border border-[var(--chip-line)] bg-[var(--sea-ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSaving ? "Publishing..." : "Publish post"}
            </button>

            <Link
              to={appRoutes.spaceBySlug(normalizedSpaceSlug).to}
              params={appRoutes.spaceBySlug(normalizedSpaceSlug).params}
              className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
