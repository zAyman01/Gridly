import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { tasksApi, aiApi } from "../api";
import type { Task, BoardMember, CustomField, User, ChecklistItem, TaskDependency } from "../types";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { getAvatarColor, getInitials } from "../lib/identity";
import MarkdownEditor from "./MarkdownEditor";
import ChecklistSection from "./ChecklistSection";
import CommentThread from "./CommentThread";
import AttachmentZone from "./AttachmentZone";

interface Props {
  task: Task;
  boardId: string;
  members: BoardMember[];
  /** Field schema defined on the board — drives the Custom fields section. */
  customFields?: CustomField[];
  /** Every card on the board, used to pick dependencies. */
  boardTasks?: Task[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

type Tab = "details" | "checklist" | "comments" | "attachments";

function resolveUser(user: string | User): User | null {
  if (typeof user === "string") return null;
  return user;
}

function dependencyId(dep: TaskDependency): string {
  return typeof dep.task === "string" ? dep.task : dep.task._id;
}

export default function TaskDetailModal({ task, boardId, members, customFields = [], boardTasks = [], onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    task.assignees.map((a) => (typeof a === "string" ? a : a._id))
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [coverImage, setCoverImage] = useState(task.coverImage || "");
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({ ...(task.customFieldValues || {}) });
  const [dependencies, setDependencies] = useState<{ task: string; type: "blocks" | "blocked_by" }[]>(
    (task.dependencies || []).map((d) => ({ task: dependencyId(d), type: d.type }))
  );
  const [depPick, setDepPick] = useState("");
  const [depType, setDepType] = useState<"blocks" | "blocked_by">("blocks");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusRef = useFocusTrap(true);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      await tasksApi.update(boardId, task._id, {
        title: title.trim(),
        description,
        priority,
        status,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
        tags,
        assignees: selectedAssignees,
        coverImage: coverImage.trim() || null,
        customFieldValues: fieldValues,
        dependencies,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : "Could not save this card");
    } finally {
      setSaving(false);
    }
  }, [boardId, task._id, title, description, priority, status, dueDate, tags, selectedAssignees, coverImage, fieldValues, dependencies, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await tasksApi.delete(boardId, task._id);
      onDeleted();
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  }, [boardId, task._id, onDeleted]);

  const handleDraftDescription = useCallback(async () => {
    setGeneratingDesc(true);
    setSaveError("");
    try {
      const data = await aiApi.draftDescription(boardId, task._id);
      setDescription(data);
    } catch (err) {
      console.error("Failed to draft description", err);
      setSaveError(err instanceof Error ? err.message : "AI could not draft a description");
    } finally {
      setGeneratingDesc(false);
    }
  }, [boardId, task._id]);

  const handleGenerateSteps = useCallback(async () => {
    setGeneratingSteps(true);
    setSaveError("");
    try {
      const newItems = await aiApi.breakdownTask(boardId, task._id);
      setChecklist(newItems);
    } catch (err) {
      console.error("Failed to generate checklist", err);
      setSaveError(err instanceof Error ? err.message : "AI could not break this task down");
    } finally {
      setGeneratingSteps(false);
    }
  }, [boardId, task._id]);

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  function handleTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function toggleAssignee(userId: string) {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function setField(name: string, value: unknown) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  function addDependency() {
    if (!depPick) return;
    if (dependencies.some((d) => d.task === depPick && d.type === depType)) return;
    setDependencies((prev) => [...prev, { task: depPick, type: depType }]);
    setDepPick("");
  }

  function removeDependency(index: number) {
    setDependencies((prev) => prev.filter((_, i) => i !== index));
  }

  const taskTitleById = new Map(boardTasks.map((t) => [t._id, t.title]));
  const linkable = boardTasks.filter((t) => t._id !== task._id);
  const checklistDone = checklist.filter((i) => i.done).length;

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: "details", label: "Details" },
    { key: "checklist", label: "Checklist", badge: checklist.length > 0 ? `${checklistDone}/${checklist.length}` : undefined },
    { key: "comments", label: "Comments" },
    { key: "attachments", label: "Files" },
  ];

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel modal-panel-lg" ref={(el) => { (panelRef as any).current = el; (focusRef as any).current = el; }} role="dialog" aria-modal="true" aria-label={task.title}>
        <div className="modal-head">
          <span className="eyebrow">Card</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {/* Title — always visible */}
        <div className="modal-section">
          <label htmlFor="task-title" className="field-label">Title</label>
          <textarea
            ref={titleRef}
            id="task-title"
            className="textarea"
            style={{ minHeight: "44px", fontSize: "1rem", fontWeight: 600 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={1}
          />
        </div>

        {/* Tab bar */}
        <div className="modal-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`modal-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
              {tab.badge && <span className="modal-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="modal-tab-content">
          {activeTab === "details" && (
            <>
              {/* Description */}
              <div className="modal-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span className="field-label" style={{ margin: 0 }}>Description</span>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={handleDraftDescription} 
                    disabled={generatingDesc}
                    title="Generate a description based on the title"
                    type="button"
                  >
                    {generatingDesc ? "✨ Drafting..." : "✨ Draft with AI"}
                  </button>
                </div>
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="What does done look like? Supports **markdown**…"
                />
              </div>

              {/* Priority */}
              <div className="modal-section">
                <span className="field-label">Priority</span>
                <div className="option-group">
                  {(["low", "medium", "high", "urgent"] as const).map((p) => (
                    <button
                      key={p}
                      className={`option-btn ${priority === p ? "active" : ""} ${
                        p === "urgent" ? "danger" : p === "high" ? "warning" : ""
                      }`}
                      onClick={() => setPriority(p)}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="modal-section">
                <span className="field-label">Status</span>
                <div className="option-group">
                  {(["todo", "in_progress", "done"] as const).map((s) => (
                    <button
                      key={s}
                      className={`option-btn ${status === s ? "active" : ""} ${
                        s === "done" ? "success" : s === "in_progress" ? "warning" : ""
                      }`}
                      onClick={() => setStatus(s)}
                    >
                      {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div className="modal-section">
                <label htmlFor="task-due" className="field-label">Due date</label>
                <input
                  id="task-due"
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Tags */}
              <div className="modal-section">
                <label htmlFor="task-tags" className="field-label">Tags</label>
                <div className="tag-chips mb-1">
                  {tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                      <span className="tag-chip-remove" onClick={() => removeTag(tag)}>
                        &times;
                      </span>
                    </span>
                  ))}
                </div>
                <input
                  id="task-tags"
                  className="input"
                  placeholder="Type a tag, press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={addTag}
                />
              </div>

              {/* Assignees */}
              <div className="modal-section">
                <span className="field-label">Assignees</span>
                <div style={{ maxHeight: "168px", overflowY: "auto" }}>
                  {members.map((m) => {
                    const user = resolveUser(m.user);
                    const uid = user ? user._id : (m.user as string);
                    const name = user ? user.name : "Unknown";
                    const isSelected = selectedAssignees.includes(uid);
                    return (
                      <div
                        key={uid}
                        className={`assignee-option ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleAssignee(uid)}
                      >
                        <div
                          className="avatar avatar-sm"
                          style={{ background: getAvatarColor(uid), borderWidth: "1px" }}
                        >
                          {getInitials(name)}
                        </div>
                        <span className="body-text text-sm">{name}</span>
                        {m.role === "owner" && (
                          <span className="meta-text ml-auto">Owner</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cover image */}
              <div className="modal-section">
                <label htmlFor="task-cover" className="field-label">Cover image URL</label>
                {coverImage && (
                  <div className="task-cover-preview">
                    <img src={coverImage} alt="" loading="lazy" />
                  </div>
                )}
                <input
                  id="task-cover"
                  className="input"
                  placeholder="https://… (paste an attachment link)"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                />
              </div>

              {/* Custom fields — schema comes from the board */}
              {customFields.length > 0 && (
                <div className="modal-section">
                  <span className="field-label">Custom fields</span>
                  <div className="custom-fields">
                    {customFields.map((field) => {
                      const value = fieldValues[field.name];
                      const id = `cf-${field.name}`;
                      return (
                        <div className="custom-field" key={field.name}>
                          <label htmlFor={id} className="custom-field-label">
                            {field.name}
                            {field.required && <span className="custom-field-req"> *</span>}
                          </label>

                          {field.type === "checkbox" ? (
                            <input
                              id={id}
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) => setField(field.name, e.target.checked)}
                            />
                          ) : field.type === "select" ? (
                            <select
                              id={id}
                              className="input select-input"
                              value={String(value ?? "")}
                              onChange={(e) => setField(field.name, e.target.value)}
                            >
                              <option value="">—</option>
                              {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "multiselect" ? (
                            <div className="tag-chips">
                              {(field.options || []).map((opt) => {
                                const list = Array.isArray(value) ? (value as string[]) : [];
                                const on = list.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    className={`option-btn ${on ? "active" : ""}`}
                                    onClick={() =>
                                      setField(field.name, on ? list.filter((v) => v !== opt) : [...list, opt])
                                    }
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <input
                              id={id}
                              className="input"
                              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                              value={String(value ?? "")}
                              onChange={(e) =>
                                setField(field.name, field.type === "number"
                                  ? (e.target.value === "" ? "" : Number(e.target.value))
                                  : e.target.value)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dependencies */}
              <div className="modal-section">
                <span className="field-label">Dependencies</span>
                {dependencies.length > 0 && (
                  <ul className="dep-list">
                    {dependencies.map((dep, i) => (
                      <li className="dep-item" key={`${dep.task}-${dep.type}-${i}`}>
                        <span className={`dep-kind ${dep.type}`}>
                          {dep.type === "blocks" ? "Blocks" : "Blocked by"}
                        </span>
                        <span className="dep-title">{taskTitleById.get(dep.task) || "Card on this board"}</span>
                        <button
                          className="icon-btn danger"
                          onClick={() => removeDependency(i)}
                          aria-label="Remove dependency"
                          type="button"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="dep-add">
                  <select
                    className="input select-input"
                    value={depType}
                    onChange={(e) => setDepType(e.target.value as "blocks" | "blocked_by")}
                    aria-label="Dependency type"
                  >
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked by</option>
                  </select>
                  <select
                    className="input select-input"
                    value={depPick}
                    onChange={(e) => setDepPick(e.target.value)}
                    aria-label="Dependency card"
                  >
                    <option value="">Pick a card…</option>
                    {linkable.map((t) => (
                      <option key={t._id} value={t._id}>{t.title}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary btn-sm" onClick={addDependency} disabled={!depPick} type="button">
                    Link
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "checklist" && (
            <div className="modal-section" style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerateSteps}
                  disabled={generatingSteps}
                  title="Generate a checklist of actionable steps"
                  type="button"
                >
                  {generatingSteps ? "✨ Generating..." : "✨ Auto-generate steps"}
                </button>
              </div>
              <ChecklistSection
                boardId={boardId}
                taskId={task._id}
                items={checklist}
                onChanged={setChecklist}
              />
            </div>
          )}

          {activeTab === "comments" && (
            <CommentThread boardId={boardId} taskId={task._id} />
          )}

          {activeTab === "attachments" && (
            <AttachmentZone boardId={boardId} taskId={task._id} />
          )}
        </div>

        {saveError && (
          <div className="error-banner" role="alert">{saveError}</div>
        )}

        {/* Actions */}
        <div className="modal-foot">
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete card"}
          </button>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Cancel">
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
