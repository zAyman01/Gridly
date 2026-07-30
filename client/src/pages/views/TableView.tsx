import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PRIORITY_LAMP } from "./KanbanView";
import { getAvatarColor, getInitials } from "../../lib/identity";
import type { List, Task } from "../../types";

interface Props {
  boardId: string;
  lists: List[];
  tasksByList: Record<string, Task[]>;
  filterFn: (task: Task) => boolean;
  onSelectTask: (task: Task) => void;
  fetchBoard: () => void;
}

export default function TableView({ lists, tasksByList, filterFn, onSelectTask }: Props) {
  const allTasks = useMemo(() => {
    const result: { task: Task; listName: string }[] = [];
    for (const list of lists) {
      const listTasks = tasksByList[list._id] || [];
      for (const task of listTasks) {
        result.push({ task, listName: list.title });
      }
    }
    return result.filter(item => filterFn(item.task));
  }, [lists, tasksByList, filterFn]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: allTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // 44px row height
    overscan: 5,
  });

  return (
    <div className="table-view" ref={parentRef}>
      <div className="table-container">
        <div className="table-header">
          <div className="table-th table-col-title">Task Name</div>
          <div className="table-th table-col-list">List</div>
          <div className="table-th table-col-priority">Priority</div>
          <div className="table-th table-col-due">Due Date</div>
          <div className="table-th table-col-assignees">Assignees</div>
        </div>
        
        {allTasks.length === 0 ? (
          <div className="table-empty">No tasks found.</div>
        ) : (
          <div
            className="table-body"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = allTasks[virtualRow.index];
              if (!row) return null;
              const { task, listName } = row;
              return (
                <div
                  key={virtualRow.key}
                  className="table-row"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onSelectTask(task)}
                >
                  <div className="table-td table-col-title">
                    <span className={`status-indicator ${task.status === "done" ? "done" : ""}`} />
                    <span className="task-title-text">{task.title}</span>
                  </div>
                  <div className="table-td table-col-list">
                    <span className="meta-text">{listName}</span>
                  </div>
                  <div className="table-td table-col-priority">
                    {task.priority && task.priority !== "medium" ? (
                      <span className="label-chip">
                        <span className="lamp" style={{ ["--lamp-color" as string]: PRIORITY_LAMP[task.priority] }} />
                        {task.priority}
                      </span>
                    ) : (
                      <span className="meta-text empty-state">-</span>
                    )}
                  </div>
                  <div className="table-td table-col-due">
                    {task.dueDate ? (
                      <span className="meta-text">
                        {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="meta-text empty-state">-</span>
                    )}
                  </div>
                  <div className="table-td table-col-assignees">
                    {task.assignees && task.assignees.length > 0 ? (
                      <div className="avatar-stack">
                        {task.assignees.map((a: any) => {
                          const uid = typeof a === "string" ? a : a._id;
                          const name = typeof a === "string" ? "" : a.name;
                          return (
                            <div
                              key={uid}
                              className="avatar avatar-xs"
                              style={{ background: getAvatarColor(uid) }}
                              title={name}
                            >
                              {getInitials(name || "?")}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="meta-text empty-state">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
