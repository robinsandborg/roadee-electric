import { Link } from "@tanstack/react-router";
import { appRoutes } from "#/lib/routes";
import { plainTextFromRichText } from "#/lib/posts/api-client";
import type { FeedItem } from "#/lib/posts/types";

type PostCardProps = {
  spaceSlug: string;
  item: FeedItem;
  canEdit: boolean;
  isTogglingUpvote: boolean;
  onToggleUpvote: () => void;
};

export default function PostCard(props: PostCardProps) {
  const preview = plainTextFromRichText(props.item.post.bodyRichText);

  return (
    <article className="rounded-2xl border border-[var(--chip-line)] bg-[var(--island-bg)] p-4 shadow-[var(--island-shadow)] sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {props.item.category ? (
          <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 font-semibold uppercase">
            {props.item.category.name}
          </span>
        ) : null}
        {props.item.tags.slice(0, 4).map((tag) => (
          <span
            key={tag.id}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 text-[11px]"
          >
            #{tag.name}
          </span>
        ))}
      </div>

      <h3 className="mt-3 text-xl leading-tight font-bold text-[var(--sea-ink)]">
        <Link
          to={appRoutes.postById(props.spaceSlug, props.item.post.id).to}
          params={appRoutes.postById(props.spaceSlug, props.item.post.id).params}
          className="no-underline"
        >
          {props.item.post.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--sea-ink-soft)]">
        {preview || "No body content provided yet."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--sea-ink-soft)]">
        <span>{props.item.commentCount} comments</span>
        <button
          type="button"
          onClick={props.onToggleUpvote}
          disabled={props.isTogglingUpvote}
          className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 font-semibold text-[var(--sea-ink)] disabled:opacity-70"
        >
          {props.isTogglingUpvote
            ? "Updating..."
            : props.item.hasUpvoted
              ? `Upvoted (${props.item.upvoteCount})`
              : `Upvote (${props.item.upvoteCount})`}
        </button>

        <Link
          to={appRoutes.postById(props.spaceSlug, props.item.post.id).to}
          params={appRoutes.postById(props.spaceSlug, props.item.post.id).params}
          className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 font-semibold text-[var(--sea-ink)] no-underline"
        >
          Open thread
        </Link>

        {props.canEdit ? (
          <Link
            to={appRoutes.editPostById(props.spaceSlug, props.item.post.id).to}
            params={appRoutes.editPostById(props.spaceSlug, props.item.post.id).params}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 font-semibold text-[var(--sea-ink)] no-underline"
          >
            Edit
          </Link>
        ) : null}
      </div>
    </article>
  );
}
