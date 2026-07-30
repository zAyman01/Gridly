import { useState, useMemo, useRef, useEffect } from "react";
import type { List, Task } from "../../types";
import { PRIORITY_LAMP } from "./KanbanView";

interface Props {
  boardId: string;
  lists: List[];
  tasksByList: Record<string, Task[]>;
  filterFn: (task: Task) => boolean;
  onSelectTask: (task: Task) => void;
  fetchBoard: () => void;
}

const DAY_WIDTH = 40; // pixels per day

export default function TimelineView({ lists, tasksByList, filterFn, onSelectTask }: Props) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // start 1 week ago
    return d;
  });

  const allTasks = useMemo(() => {
    const result: { task: Task; listName: string }[] = [];
    for (const list of lists) {
      const listTasks = tasksByList[list._id] || [];
      for (const task of listTasks) {
        if (filterFn(task)) {
          result.push({ task, listName: list.title });
        }
      }
    }
    // Sort by createdAt
    return result.sort((a, b) => new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime());
  }, [lists, tasksByList, filterFn]);

  // Generate 60 days of timeline headers
  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [startDate]);

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Center on today initially
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 7 * DAY_WIDTH - (containerRef.current.clientWidth / 2);
    }
  }, []);

  const moveLeft = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() - 14);
    setStartDate(d);
  };

  const moveRight = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 14);
    setStartDate(d);
  };

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const getTaskStyle = (task: Task) => {
    const created = new Date(task.createdAt);
    const due = task.dueDate ? new Date(task.dueDate) : new Date(created);
    
    // If no due date, just make it 1 day long
    if (!task.dueDate) {
      due.setDate(due.getDate() + 1);
    }

    // Ensure due is >= created
    if (due.getTime() < created.getTime()) {
      due.setTime(created.getTime() + 86400000); // add 1 day
    }

    const startDiff = (created.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (due.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

    return {
      left: `${Math.max(0, startDiff) * DAY_WIDTH}px`,
      width: `${Math.max(1, duration) * DAY_WIDTH}px`, // min 1 day width
      "--event-color": task.priority && task.priority !== "medium" ? PRIORITY_LAMP[task.priority] : "var(--muted)"
    } as React.CSSProperties;
  };

  return (
    <div className="timeline-view">
      <div className="timeline-header-controls">
        <h2>Timeline</h2>
        <div className="timeline-nav">
          <button className="btn btn-secondary btn-sm" onClick={moveLeft}>&larr; Earlier</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setStartDate(new Date(new Date().setDate(new Date().getDate() - 7)))}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={moveRight}>Later &rarr;</button>
        </div>
      </div>

      <div className="timeline-container" ref={containerRef}>
        <div className="timeline-grid" style={{ width: `${days.length * DAY_WIDTH}px` }}>
          {/* Header row for days */}
          <div className="timeline-days-row">
            {days.map((day, i) => {
              const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              return (
                <div key={i} className={`timeline-day-header ${isToday ? "today" : ""}`} style={{ width: `${DAY_WIDTH}px` }}>
                  <span className="day-name">{["S", "M", "T", "W", "T", "F", "S"][day.getDay()]}</span>
                  <span className="day-num">{day.getDate()}</span>
                </div>
              );
            })}
          </div>

          {/* Grid lines */}
          <div className="timeline-grid-lines">
            {days.map((day, i) => {
              const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              return (
                <div key={i} className={`timeline-grid-line ${isToday ? "today" : ""}`} style={{ width: `${DAY_WIDTH}px`, left: `${i * DAY_WIDTH}px` }} />
              );
            })}
          </div>

          {/* Task rows */}
          <div className="timeline-tasks-area">
            {allTasks.length === 0 ? (
              <div className="table-empty" style={{ position: "absolute", width: "100%", left: 0 }}>No tasks found.</div>
            ) : (
              allTasks.map(({ task, listName }) => (
                <div key={task._id} className="timeline-task-row">
                  <div className="timeline-task-label">
                    <span className="task-title-text">{task.title}</span>
                    <span className="meta-text timeline-task-sub">
                      {listName}
                      {task.dependencies && task.dependencies.length > 0 && (
                        <span className="timeline-dep-flag" title="Has dependencies">
                          {" · "}
                          {task.dependencies.filter((d) => d.type === "blocked_by").length > 0 ? "blocked" : "blocks"}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="timeline-task-track">
                    <div
                      className={`timeline-task-bar ${task.status === "done" ? "completed" : ""}`}
                      style={getTaskStyle(task)}
                      onClick={() => onSelectTask(task)}
                      title={`${task.title}\nCreated: ${new Date(task.createdAt).toLocaleDateString()}\nDue: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "None"}`}
                    >
                      <span className="timeline-task-bar-label">{task.title}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
