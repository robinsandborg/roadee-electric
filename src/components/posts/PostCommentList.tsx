import { plainTextFromRichText } from "#/lib/posts/api-client";
import type { CommentRecord } from "#/lib/posts/types";

type PostCommentListProps = {
  comments: CommentRecord[];
};

export default function PostCommentList(props: PostCommentListProps) {
  if (props.comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-5 text-sm text-[var(--sea-ink-soft)]">
        No comments yet. Start the thread.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {props.comments.map((comment) => (
        <article
          key={comment.id}
          className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] p-3"
        >
          <div className="text-xs text-[var(--sea-ink-soft)]">
            <code>{comment.authorId}</code>
          </div>
          <p className="m-0 mt-2 text-sm leading-6 text-[var(--sea-ink)]">
            {plainTextFromRichText(comment.bodyRichText) || "(empty comment)"}
          </p>
        </article>
      ))}
    </div>
  );
}
