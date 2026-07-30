import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../../auth";
import { ThemeProvider } from "../../theme";
import CommandPalette, { CommandPaletteTrigger } from "../../components/CommandPalette";

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

function renderPalette() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <CommandPaletteTrigger />
          <CommandPalette />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("CommandPalette", () => {
  it("does not render modal initially", () => {
    renderPalette();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens modal when CommandPaletteTrigger is clicked", async () => {
    renderPalette();
    const triggerBtn = screen.getByRole("button", { name: /open command palette/i });
    await userEvent.click(triggerBtn);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByPlaceholderText(/search commands, workspaces, and boards/i)).toBeTruthy();
  });

  it("opens modal when open-cmd-k event is dispatched", () => {
    renderPalette();
    fireEvent(window, new CustomEvent("open-cmd-k"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes modal when ESC key is pressed", async () => {
    renderPalette();
    fireEvent(window, new CustomEvent("open-cmd-k"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters commands when typing in search input", async () => {
    renderPalette();
    fireEvent(window, new CustomEvent("open-cmd-k"));
    const input = screen.getByPlaceholderText(/search commands, workspaces, and boards/i);
    await userEvent.type(input, "theme");
    expect(screen.getByText("Toggle theme")).toBeTruthy();
    expect(screen.queryByText("Home page")).toBeNull();
  });

  it("shows empty message when no commands match query", async () => {
    renderPalette();
    fireEvent(window, new CustomEvent("open-cmd-k"));
    const input = screen.getByPlaceholderText(/search commands, workspaces, and boards/i);
    await userEvent.type(input, "nonexistentcommandhere");
    expect(screen.getByText("No matching commands or items")).toBeTruthy();
  });

  it("executes command when Enter is pressed", async () => {
    renderPalette();
    fireEvent(window, new CustomEvent("open-cmd-k"));
    const input = screen.getByPlaceholderText(/search commands, workspaces, and boards/i);
    await userEvent.type(input, "theme");
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
