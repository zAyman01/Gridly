import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import LoginPage from "../../pages/LoginPage";
import { ThemeProvider } from "../../theme";

const mockLogin = vi.fn();
vi.mock("../../auth", () => ({
  useAuth: () => ({ login: mockLogin, user: null, isAuth: false, isLoading: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form", () => {
    renderPage();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
  });

  it("shows error on failed login", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Invalid credentials")).toBeTruthy();
  });

  it("shows generic error on network failure", async () => {
    mockLogin.mockRejectedValueOnce(new Error("NetworkError"));
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "pass123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("NetworkError")).toBeTruthy();
  });
});
