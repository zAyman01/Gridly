import { useState, type FormEvent } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { listsApi, tasksApi } from "../../api";
import { getAvatarColor, getInitials } from "../../lib/identity";
import type { List, Task } from "../../types";

export const PRIORITY_LAMP: Record<string, string> = {
  urgent: "var(--color-stop)",
  high: "var(--color-signal)",
  medium: "var(--color-violet)",
  low: "var(--color-steel)",
};

export function stationColor(index: number, total: number): string {
  if (total > 1 && index === total - 1) return "var(--color-clear)";
  if (index === 0) return "var(--color-steel)";
  return index % 2 === 1 ? "var(--color-flow)" : "var(--color-signal)";
}

function Icon({ path, size = 14 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

interface KanbanViewProps {
  boardId: string;
  lists: List[];
  setLists: (lists: List[]) => void;
  tasksByList: Record<string, Task[]>;
  setTasksByList: (tasksByList: Record<string, Task[]>) => void;
  fetchBoard: () => void;
  filterFn: (task: Task) => boolean;
  hasActiveFilters: boolean;
  onSelectTask: (task: Task) => void;
}

export default function KanbanView({
  boardId, lists, setLists, tasksByList, setTasksByList, fetchBoard, filterFn, hasActiveFilters, onSelectTask
}: KanbanViewProps) {
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});

  async function handleAddList(e: FormEvent) {
    e.preventDefault();
    if (!boardId || !newListTitle.trim()) return;
    try {
      await listsApi.create(boardId, { title: newListTitle });
      setNewListTitle("");
      fetchBoard();
    } catch (err) { console.error(err); }
  }

  async function handleAddTask(listId: string) {
    if (!boardId || !taskInputs[listId]?.trim()) return;
    try {
      await tasksApi.create(boardId, { title: taskInputs[listId]!, listId });
      setTaskInputs((prev) => ({ ...prev, [listId]: "" }));
      fetchBoard();
    } catch (err) { console.error(err); }
  }

  async function handleDeleteTask(taskId: string) {
    if (!boardId) return;
    try {
      await tasksApi.delete(boardId, taskId);
      fetchBoard();
    } catch (err) { console.error(err); }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination || !boardId) return;
    const { source, destination } = result;

    if (source.droppableId === "all-columns") {
      const newLists = Array.from(lists);
      const [moved] = newLists.splice(source.index, 1);
      if (!moved) return;
      newLists.splice(destination.index, 0, moved);
      setLists(newLists);
      const orders = newLists.map((l, i) => ({ listId: l._id, position: i }));
      listsApi.reorder(boardId, orders).catch(() => fetchBoard());
      return;
    }

    const srcList = source.droppableId;
    const destList = destination.droppableId;
    if (srcList === destList && source.index === destination.index) return;

    const updatedTasksByList = { ...tasksByList };
    const srcTasks = Array.from(updatedTasksByList[srcList] || []);
    const [movedTask] = srcTasks.splice(source.index, 1);
    if (!movedTask) return;
    updatedTasksByList[srcList] = srcTasks;

    if (srcList === destList) {
      srcTasks.splice(destination.index, 0, movedTask);
      updatedTasksByList[srcList] = srcTasks;
    } else {
      const destTasks = Array.from(updatedTasksByList[destList] || []);
      destTasks.splice(destination.index, 0, movedTask);
      updatedTasksByList[destList] = destTasks;
    }

    setTasksByList(updatedTasksByList);
    tasksApi.move(boardId, movedTask._id, { targetListId: destList, position: destination.index }).catch(() => fetchBoard());
  }

  function handleRenameStart(list: List) {
    setRenamingListId(list._id);
    setRenameValue(list.title);
  }

  async function handleRenameSubmit(listId: string) {
    if (!boardId) return;
    const val = renameValue.trim();
    if (val) await listsApi.update(boardId, listId, { title: val }).catch(() => {});
    setRenamingListId(null);
    fetchBoard();
  }

  async function handleDeleteList(listId: string) {
    if (!boardId) return;
    const taskCount = (tasksByList[listId] || []).length;
    const msg = taskCount > 0
      ? `Delete this column and its ${taskCount} card${taskCount > 1 ? "s" : ""}?`
      : "Delete this empty column?";
    if (!window.confirm(msg)) return;
    await listsApi.delete(boardId, listId).catch(() => {});
    fetchBoard();
  }

  return (
    <div className="bv-canvas">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="all-columns" direction="horizontal" type="COLUMN">
          {(dropCols) => (
            <div className="board-layout" ref={dropCols.innerRef} {...dropCols.droppableProps}>
              {lists.map((list, index) => {
                const tasks = tasksByList[list._id] || [];
                const visible = tasks.filter(filterFn);
                const station = stationColor(index, lists.length);
                const isTerminus = lists.length > 1 && index === lists.length - 1;

                return (
                  <Draggable draggableId={`column-${list._id}`} index={index} key={list._id}>
                    {(dragCol, colSnap) => (
                      <div
                        className={`column ${colSnap.isDragging ? "dragging-column" : ""}`}
                        ref={dragCol.innerRef}
                        {...dragCol.draggableProps}
                        style={{ ...dragCol.draggableProps.style, ["--station-color" as string]: station }}
                      >
                        <span className={`column-station ${isTerminus ? "terminus" : ""}`} aria-hidden="true" />
                        <div className="column-plate">
                          <div className="column-header" {...dragCol.dragHandleProps}>
                            {renamingListId === list._id ? (
                              <input
                                className="inline-edit-input"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameSubmit(list._id);
                                  if (e.key === "Escape") setRenamingListId(null);
                                }}
                                onBlur={() => handleRenameSubmit(list._id)}
                                autoFocus
                                aria-label="Column name"
                              />
                            ) : (
                              <>
                                <span className="column-name">{list.title}</span>
                                <span className="wip">{String(visible.length).padStart(2, "0")}</span>
                                <div className="column-actions">
                                  <button
                                    className="icon-btn"
                                    onClick={(e) => { e.stopPropagation(); handleRenameStart(list); }}
                                    aria-label={`Rename column ${list.title}`}
                                  >
                                    <Icon path={<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>} size={12} />
                                  </button>
                                  <button
                                    className="icon-btn danger"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteList(list._id); }}
                                    aria-label={`Delete column ${list.title}`}
                                  >
                                    <Icon path={<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>} size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          <Droppable droppableId={list._id} type="TASK">
                            {(dropTasks, taskSnap) => (
                              <div
                                className={`column-body ${taskSnap.isDraggingOver ? "droppable-over" : ""}`}
                                ref={dropTasks.innerRef}
                                {...dropTasks.droppableProps}
                              >
                                {visible.length === 0 && (
                                  <p className="bv-empty-col meta-text">
                                    {hasActiveFilters ? "No match here" : "Nothing queued"}
                                  </p>
                                )}

                                {visible.map((task, idx) => (
                                  <Draggable draggableId={`task-${task._id}`} index={idx} key={task._id}>
                                    {(dragTask, taskDragSnap) => (
                                      <div
                                        ref={dragTask.innerRef}
                                        {...dragTask.draggableProps}
                                        {...dragTask.dragHandleProps}
                                        style={dragTask.draggableProps.style}
                                      >
                                        <div
                                          className={`task-card task-card-enter ${taskDragSnap.isDragging ? "dragging-task" : ""} ${task.status === "done" ? "completed" : ""}`}
                                          style={{ ["--slip-color" as string]: PRIORITY_LAMP[task.priority]! }}
                                          onClick={() => onSelectTask(task)}
                                          onKeyDown={(e) => { if (e.key === "Enter") onSelectTask(task); }}
                                          role="button"
                                          tabIndex={0}
                                          aria-label={`Open card: ${task.title}`}
                                        >
                                          {task.coverImage && (
                                            <div className="task-card-cover">
                                              <img src={task.coverImage} alt="" loading="lazy" />
                                            </div>
                                          )}

                                          <div className="bv-card-top">
                                            <p className="task-card-title">{task.title}</p>
                                            <button
                                              className="icon-btn danger bv-card-delete"
                                              onClick={(e) => { e.stopPropagation(); handleDeleteTask(task._id); }}
                                              aria-label={`Delete card: ${task.title}`}
                                            >
                                              <Icon path={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} size={11} />
                                            </button>
                                          </div>

                                          {(task.priority !== "medium" || task.dueDate || task.tags?.length > 0 || (task.checklist && task.checklist.length > 0) || (task.dependencies && task.dependencies.length > 0)) && (
                                            <div className="task-card-row">
                                              {task.priority !== "medium" && (
                                                <span className="label-chip">
                                                  <span className="lamp" style={{ ["--lamp-color" as string]: PRIORITY_LAMP[task.priority]! }} />
                                                  {task.priority}
                                                </span>
                                              )}
                                              {task.dueDate && (
                                                <span className="meta-text">
                                                  {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                                </span>
                                              )}
                                              {task.checklist && task.checklist.length > 0 && (
                                                <span className="meta-text" title="Checklist progress">
                                                  ✓ {task.checklist.filter(i => i.done).length}/{task.checklist.length}
                                                </span>
                                              )}
                                              {task.dependencies && task.dependencies.length > 0 && (
                                                <span className="label-chip" title="Linked cards">
                                                  <span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-stop)" }} />
                                                  {task.dependencies.some((d) => d.type === "blocked_by") ? "blocked" : "blocks"}
                                                </span>
                                              )}
                                              {task.tags?.map((tag) => (
                                                <span className="label-chip" key={tag}>{tag}</span>
                                              ))}
                                            </div>
                                          )}

                                          {task.assignees.length > 0 && (
                                            <div className="avatar-stack task-card-row">
                                              {task.assignees.map((a) => {
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
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {dropTasks.placeholder}

                                <input
                                  className="input bv-add-card"
                                  placeholder="Add a card"
                                  value={taskInputs[list._id] || ""}
                                  onChange={(e) => setTaskInputs((prev) => ({ ...prev, [list._id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(list._id); }}
                                  aria-label={`Add a card to ${list.title}`}
                                />
                              </div>
                            )}
                          </Droppable>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {dropCols.placeholder}

              <div className="column bv-new-column">
                <span className="column-station bv-station-open" aria-hidden="true" />
                <form onSubmit={handleAddList} className="bv-new-column-plate">
                  <span className="field-label">New column</span>
                  <input
                    className="input"
                    placeholder="Name it, press Enter"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    aria-label="New column name"
                  />
                </form>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
