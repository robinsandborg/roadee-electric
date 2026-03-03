import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PostCommentList from "#/components/posts/PostCommentList";

describe("PostCommentList", () => {
  it("shows empty state", () => {
    render(<PostCommentList comments={[]} />);

    expect(screen.getByText("No comments yet. Start the thread.")).toBeTruthy();
  });

  it("renders comment body text", () => {
    render(
      <PostCommentList
        comments={[
          {
            id: "comment-1",
            postId: "post-1",
            spaceId: "space-1",
            authorId: "user-1",
            bodyRichText: { type: "doc", text: "Looks good" },
            createdAt: "2026-03-03T10:00:00.000Z",
            updatedAt: "2026-03-03T10:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Looks good")).toBeTruthy();
  });
});
