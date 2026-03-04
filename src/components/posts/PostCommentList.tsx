import { plainTextFromRichText } from "#/lib/posts/api-client";
import type { CommentRecord } from "#/lib/posts/types";

type PostCommentListProps = {
  comments: CommentRecord[];
};

export default function PostCommentList(props: PostCommentListProps) {
  if (props.comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-chip-line bg-chip-bg px-4 py-5 text-sm text-sea-ink-soft">
        No comments yet. Start the thread.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {props.comments.map((comment) => (
        <article
          key={comment.id}
          className="rounded-xl border border-chip-line bg-chip-bg p-3"
        >
          <div className="text-xs text-sea-ink-soft">
            <code>{comment.authorId}</code>
          </div>
          <p className="m-0 mt-2 text-sm leading-6 text-sea-ink">
            {plainTextFromRichText(comment.bodyRichText) || "(empty comment)"}
          </p>
        </article>
      ))}
    </div>
  );
}
