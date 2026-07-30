import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardSettingsModal from "../../components/BoardSettingsModal";
import type { Board } from "../../types";

const mockBoard: Board = {
  _id: "board1",
  title: "My Board",
  description: "A description",
  workspace: "workspace1",
  owner: "user1",
  members: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  global.fetch = vi.fn();
});

function renderModal(props: Partial<Parameters<typeof BoardSettingsModal>[0]> = {}) {
  return render(
    <BoardSettingsModal
      board={mockBoard}
      boardId="board1"
      onClose={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />
  );
}

describe("BoardSettingsModal", () => {
  it("renders with board title and description", () => {
    renderModal();
    expect(screen.getByDisplayValue("My Board")).toBeTruthy();
    expect(screen.getByDisplayValue("A description")).toBeTruthy();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onSaved after save succeeds", async () => {
    const onSaved = vi.fn();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });
    renderModal({ onSaved });
    await userEvent.click(screen.getByText("Save"));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("shows error on save failure", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Save failed" } }),
    });
    renderModal();
    await userEvent.click(screen.getByText("Save"));
    expect(await screen.findByText("Save failed")).toBeTruthy();
  });

  it("disables save button when title is empty", () => {
    renderModal();
    const input = screen.getByDisplayValue("My Board");
    userEvent.clear(input);
    expect(screen.getByText("Save").closest("button")).toBeDisabled();
  });
});
