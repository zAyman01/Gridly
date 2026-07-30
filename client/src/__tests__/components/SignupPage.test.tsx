import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import SignupPage from "../../pages/SignupPage";
import { ThemeProvider } from "../../theme";

const mockSignup = vi.fn();
vi.mock("../../auth", () => ({
  useAuth: () => ({ signup: mockSignup, user: null, isAuth: false, isLoading: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <SignupPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form", () => {
    renderPage();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
  });

  it("shows error on failed signup", async () => {
    mockSignup.mockRejectedValueOnce(new Error("Email already registered"));
    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "Test User");
    await userEvent.type(screen.getByLabelText("Email"), "existing@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(await screen.findByText("Email already registered")).toBeTruthy();
  });
});
