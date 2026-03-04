import { Link } from "@tanstack/react-router";
import { appRoutes } from "#/lib/routes";
import { plainTextFromRichText } from "#/lib/posts/api-client";
import type { FeedItem } from "#/lib/posts/types";

type PostThreadHeaderProps = {
  item: FeedItem;
  spaceSlug: string;
  canEdit: boolean;
  isTogglingUpvote: boolean;
  onToggleUpvote: () => void;
};

export default function PostThreadHeader(props: PostThreadHeaderProps) {
  const body = plainTextFromRichText(props.item.post.bodyRichText);

  return (
    <section className="rounded-2xl border border-[var(--chip-line)] bg-[var(--island-bg)] p-5">
      <div className="flex flex-wrap gap-2 text-xs">
        {props.item.category ? (
          <span className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 font-semibold uppercase">
            {props.item.category.name}
          </span>
        ) : null}
        {props.item.tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1"
          >
            #{tag.name}
          </span>
        ))}
      </div>

      <h1 className="mt-3 text-3xl font-bold text-[var(--sea-ink)]">{props.item.post.title}</h1>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--sea-ink-soft)]">
        {body || "No body content provided yet."}
      </p>

      {props.item.post.imageUrl ? (
        <img
          src={props.item.post.imageUrl}
          alt="Attached"
          className="mt-4 max-h-80 w-full rounded-xl border border-[var(--chip-line)] object-cover"
        />
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={props.onToggleUpvote}
          disabled={props.isTogglingUpvote}
          className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 font-semibold text-[var(--sea-ink)] disabled:opacity-70"
        >
          {props.item.hasUpvoted
            ? `Upvoted (${props.item.upvoteCount})`
            : `Upvote (${props.item.upvoteCount})`}
        </button>
        <span>{props.item.commentCount} comments</span>

        {props.canEdit ? (
          <Link
            to={appRoutes.editPostById(props.spaceSlug, props.item.post.id).to}
            params={appRoutes.editPostById(props.spaceSlug, props.item.post.id).params}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 font-semibold text-[var(--sea-ink)] no-underline"
          >
            Edit post
          </Link>
        ) : null}
      </div>
    </section>
  );
}
