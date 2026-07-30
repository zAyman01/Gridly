import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnalyticsDashboard from "../../components/AnalyticsDashboard";
import { AnalyticsSkeleton, AnalyticsFault } from "../../components/AnalyticsStates";
import type { AnalyticsData } from "../../types";

const data: AnalyticsData = {
  totalTasks: 24,
  completionRate: 0.375,
  tasksByStatus: { todo: 9, in_progress: 6, done: 9 },
  tasksByPriority: { low: 4, medium: 10, high: 7, urgent: 3 },
  tasksByAssignee: [
    { name: "Priya", count: 11, userId: "u1" },
    { name: "Wes", count: 8, userId: "u2" },
  ],
  velocity: [
    { date: "2026-07-20T00:00:00Z", count: 2 },
    { date: "2026-07-21T00:00:00Z", count: 5 },
  ],
};

const empty: AnalyticsData = {
  totalTasks: 0,
  completionRate: 0,
  tasksByStatus: { todo: 0, in_progress: 0, done: 0 },
  tasksByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
  tasksByAssignee: [],
  velocity: [],
};

describe("AnalyticsDashboard", () => {
  it("shows the headline readings", () => {
    const { container } = render(<AnalyticsDashboard data={data} title="Release 4.2" />);
    expect(screen.getByRole("heading", { name: "Release 4.2" })).toBeTruthy();

    const readings = Array.from(container.querySelectorAll(".metric-card")).map((card) => [
      card.querySelector(".metric-label")?.textContent,
      card.querySelector(".metric-val")?.textContent,
    ]);
    expect(readings).toEqual([
      ["Cards on the board", "24"],
      ["Cleared", "37.5%"],
      // the fourteen-day total, not a per-day figure
      ["Cleared in 14 days", "7"],
    ]);
  });

  it("gives every chart a text table so the data is not colour-only", () => {
    render(<AnalyticsDashboard data={data} />);
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(4);

    const workload = screen.getByRole("table", {
      name: /open cards held by each assignee/i,
    });
    expect(within(workload).getByRole("rowheader", { name: "Priya" })).toBeTruthy();
    expect(within(workload).getByRole("cell", { name: "11" })).toBeTruthy();
  });

  it("names each instrument", () => {
    render(<AnalyticsDashboard data={data} />);
    for (const name of [
      "Cards by column stage",
      "Cards by priority",
      "Workload by assignee",
      "Completion velocity",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
  });

  it("shows an empty state per chart rather than a blank axis frame", () => {
    render(<AnalyticsDashboard data={empty} />);
    expect(screen.getAllByText("No data yet")).toHaveLength(4);
    expect(screen.queryAllByRole("table")).toHaveLength(0);
  });
});

describe("AnalyticsSkeleton", () => {
  it("announces that it is loading", () => {
    const { container } = render(<AnalyticsSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByText("Loading analytics")).toBeTruthy();
  });
});

describe("AnalyticsFault", () => {
  it("offers a way back", async () => {
    const onRetry = vi.fn();
    render(<AnalyticsFault onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry control when there is nothing to retry", () => {
    render(<AnalyticsFault />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
