import { useMemo, type ReactNode } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line
} from "recharts";
import type { AnalyticsData } from "../types";
import "./AnalyticsDashboard.css";

/* Signal-lamp palette — the only colour tokens the design system defines.
   "clear" means done everywhere in the product, "flow" means moving. */
const STATUS_COLORS: Record<string, string> = {
  todo: "var(--color-steel)",
  in_progress: "var(--color-flow)",
  done: "var(--color-clear)",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--color-stop)",
  high: "var(--color-signal)",
  medium: "var(--color-violet)",
  low: "var(--color-steel)",
};

const AXIS = "var(--muted)";
const GRID = "var(--rule)";

/* Radius matches --radius-slip. Recharts takes numbers, not tokens. */
const BAR_RADIUS: [number, number, number, number] = [2, 2, 0, 0];

const TOOLTIP_STYLE = {
  background: "var(--panel)",
  border: "1px solid var(--rule)",
  borderRadius: "3px",
  boxShadow: "var(--shadow-dropdown)",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.6875rem",
} as const;

const nf = new Intl.NumberFormat();

/**
 * Every instrument ships with the same numbers as a table. The chart is
 * hidden from assistive tech and the table carries the reading, so the
 * data never depends on seeing a colour.
 *
 * The charts pass accessibilityLayer={false} for the same reason: it
 * defaults to true and puts a focusable role="application" node inside
 * this aria-hidden wrapper, which is invalid — and arrowing through an
 * SVG is a worse reading than the table anyway.
 */
function Instrument({
  title,
  unit,
  summary,
  rows,
  columns,
  children,
}: {
  title: string;
  unit?: string;
  summary: string;
  rows: { label: string; value: string }[];
  columns: [string, string];
  children: ReactNode;
}) {
  const empty = rows.length === 0;

  return (
    <figure className="chart-card">
      <figcaption className="chart-head">
        <h3 className="chart-title">{title}</h3>
        {unit && <span className="chart-unit">{unit}</span>}
      </figcaption>

      {empty ? (
        <div className="chart-empty">
          <span className="chart-empty-title">No data yet</span>
          <p className="chart-empty-text">
            This reading fills in as cards move through the board.
          </p>
        </div>
      ) : (
        <>
          <div className="chart-wrapper" aria-hidden="true">
            {children}
          </div>
          <table className="chart-table">
            <caption>{summary}</caption>
            <thead>
              <tr><th scope="col">{columns[0]}</th><th scope="col">{columns[1]}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

interface Props {
  data: AnalyticsData;
  title?: string;
}

export default function AnalyticsDashboard({ data, title = "Analytics" }: Props) {
  const statusData = useMemo(() => [
    { name: "To do", value: data.tasksByStatus.todo, key: "todo" },
    { name: "In progress", value: data.tasksByStatus.in_progress, key: "in_progress" },
    { name: "Done", value: data.tasksByStatus.done, key: "done" },
  ].filter((d) => d.value > 0), [data]);

  const priorityData = useMemo(() => [
    { name: "Urgent", value: data.tasksByPriority.urgent, fill: PRIORITY_COLORS.urgent },
    { name: "High", value: data.tasksByPriority.high, fill: PRIORITY_COLORS.high },
    { name: "Medium", value: data.tasksByPriority.medium, fill: PRIORITY_COLORS.medium },
    { name: "Low", value: data.tasksByPriority.low, fill: PRIORITY_COLORS.low },
  ].filter((d) => d.value > 0), [data]);

  const assigneeData = data.tasksByAssignee ?? [];
  const velocityData = data.velocity ?? [];

  const cleared = useMemo(
    () => velocityData.reduce((sum, d) => sum + d.count, 0),
    [velocityData],
  );

  const day = (val: string) =>
    new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="analytics-dash">
      <div className="analytics-header">
        <h2 className="analytics-title">{title}</h2>
      </div>

      <div className="analytics-ribbon">
        <div className="metric-card" style={{ ["--metric-lamp" as string]: "var(--color-steel)" }}>
          <span className="metric-label">Cards on the board</span>
          <span className="metric-val">{nf.format(data.totalTasks)}</span>
        </div>
        <div className="metric-card" style={{ ["--metric-lamp" as string]: "var(--color-clear)" }}>
          <span className="metric-label">Cleared</span>
          <span className="metric-val">{(data.completionRate * 100).toFixed(1)}%</span>
          <span className="metric-note">{nf.format(data.tasksByStatus.done)} of {nf.format(data.totalTasks)}</span>
        </div>
        <div className="metric-card" style={{ ["--metric-lamp" as string]: "var(--color-flow)" }}>
          <span className="metric-label">Cleared in 14 days</span>
          <span className="metric-val">{nf.format(cleared)}</span>
          <span className="metric-note">across {nf.format(assigneeData.length)} assignees</span>
        </div>
      </div>

      <div className="analytics-grid">
        <Instrument
          title="Cards by column stage"
          unit="share"
          summary="Share of cards in each stage."
          columns={["Stage", "Cards"]}
          rows={statusData.map((d) => ({ label: d.name, value: nf.format(d.value) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="78%"
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend verticalAlign="bottom" height={28} iconType="square" iconSize={9} />
            </PieChart>
          </ResponsiveContainer>
        </Instrument>

        <Instrument
          title="Cards by priority"
          unit="count"
          summary="Number of cards at each priority."
          columns={["Priority", "Cards"]}
          rows={priorityData.map((d) => ({ label: d.name, value: nf.format(d.value) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer={false} data={priorityData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" stroke={AXIS} tickLine={false} axisLine={false} />
              <YAxis stroke={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip cursor={{ fill: "var(--sunk)" }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" name="Cards" radius={BAR_RADIUS} maxBarSize={56} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Instrument>

        <Instrument
          title="Workload by assignee"
          unit="count"
          summary="Number of open cards held by each assignee."
          columns={["Assignee", "Cards"]}
          rows={assigneeData.map((d) => ({ label: d.name, value: nf.format(d.count) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer={false} data={assigneeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" stroke={AXIS} tickLine={false} axisLine={false} interval={0} />
              <YAxis stroke={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip cursor={{ fill: "var(--sunk)" }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Cards" fill="var(--color-steel)" radius={BAR_RADIUS} maxBarSize={56} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Instrument>

        <Instrument
          title="Completion velocity"
          unit="14 days"
          summary="Cards completed per day over the last fourteen days."
          columns={["Day", "Cleared"]}
          rows={velocityData.map((d) => ({ label: day(d.date), value: nf.format(d.count) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            {/* Wider right margin: the final tick sits on the last point,
                so a narrower one clips the closing date. */}
            <LineChart accessibilityLayer={false} data={velocityData} margin={{ top: 8, right: 22, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={AXIS}
                tickLine={false}
                axisLine={false}
                minTickGap={18}
                tickFormatter={(val) => day(String(val))}
              />
              <YAxis stroke={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(val) =>
                  new Date(String(val)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                }
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Cleared"
                stroke="var(--color-clear)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "var(--color-clear)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Instrument>
      </div>
    </div>
  );
}
