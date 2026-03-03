import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PostCard from "#/components/posts/PostCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

describe("PostCard", () => {
  const baseItem = {
    post: {
      id: "post-1",
      spaceId: "space-1",
      authorId: "author-1",
      title: "Launch checklist",
      bodyRichText: { type: "doc", text: "Ship it" },
      imageUrl: null,
      imageMeta: null,
      categoryId: null,
      createdAt: "2026-03-03T10:00:00.000Z",
      updatedAt: "2026-03-03T10:00:00.000Z",
    },
    category: null,
    tags: [],
    upvoteCount: 3,
    commentCount: 2,
    hasUpvoted: false,
  };

  it("calls onToggleUpvote when clicking upvote", () => {
    const onToggleUpvote = vi.fn();

    render(
      <PostCard
        spaceSlug="acme"
        item={baseItem}
        canEdit={false}
        isTogglingUpvote={false}
        onToggleUpvote={onToggleUpvote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upvote (3)" }));
    expect(onToggleUpvote).toHaveBeenCalledTimes(1);
  });

  it("shows author-only edit link", () => {
    const { rerender } = render(
      <PostCard
        spaceSlug="acme"
        item={baseItem}
        canEdit={false}
        isTogglingUpvote={false}
        onToggleUpvote={vi.fn()}
      />,
    );

    expect(screen.queryByText("Edit")).toBeNull();

    rerender(
      <PostCard
        spaceSlug="acme"
        item={baseItem}
        canEdit
        isTogglingUpvote={false}
        onToggleUpvote={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit")).toBeTruthy();
  });
});
