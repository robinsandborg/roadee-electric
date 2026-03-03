import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingActions from "./LandingActions";

describe("LandingActions", () => {
  it("opens provider chooser for unauthenticated create-space CTA", () => {
    const onCreateSpace = vi.fn();
    const onSignIn = vi.fn();

    render(
      <LandingActions
        isAuthenticated={false}
        isSessionPending={false}
        pendingProvider={null}
        authError={null}
        onCreateSpace={onCreateSpace}
        onSignIn={onSignIn}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create a space" }));

    expect(onCreateSpace).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to continue to space creation")).toBeTruthy();
  });

  it("navigates directly for authenticated create-space CTA", () => {
    const onCreateSpace = vi.fn();
    const onSignIn = vi.fn();

    render(
      <LandingActions
        isAuthenticated
        isSessionPending={false}
        pendingProvider={null}
        authError={null}
        onCreateSpace={onCreateSpace}
        onSignIn={onSignIn}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create a space" }));

    expect(onCreateSpace).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("calls sign-in callback with provider and intent", () => {
    const onSignIn = vi.fn();

    render(
      <LandingActions
        isAuthenticated={false}
        isSessionPending={false}
        pendingProvider={null}
        authError={null}
        onCreateSpace={vi.fn()}
        onSignIn={onSignIn}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(onSignIn).toHaveBeenCalledWith("google", "sign-in");
  });
});
