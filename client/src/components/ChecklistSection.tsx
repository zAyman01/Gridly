import { useState, type KeyboardEvent } from "react";
import { checklistApi } from "../api";
import type { ChecklistItem } from "../types";

interface Props {
  boardId: string;
  taskId: string;
  items: ChecklistItem[];
  onChanged: (items: ChecklistItem[]) => void;
}

export default function ChecklistSection({ boardId, taskId, items, onChanged }: Props) {
  const [newText, setNewText] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleAdd() {
    const text = newText.trim();
    if (!text) return;
    setNewText("");
    try {
      const updated = await checklistApi.add(boardId, taskId, { text });
      onChanged(updated);
    } catch (err) {
      console.error(err);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  async function handleToggle(item: ChecklistItem) {
    setLoading(item._id);
    try {
      const updated = await checklistApi.toggle(boardId, taskId, item._id, !item.done);
      onChanged(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove(itemId: string) {
    try {
      const updated = await checklistApi.remove(boardId, taskId, itemId);
      onChanged(updated);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="checklist-section">
      <div className="checklist-header">
        <span className="field-label">Checklist</span>
        {total > 0 && (
          <span className="checklist-progress-label mono-text">
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="checklist-progress-bar">
          <div
            className="checklist-progress-fill"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      <ul className="checklist-list">
        {items.map((item) => (
          <li key={item._id} className={`checklist-item ${item.done ? "done" : ""}`}>
            <label className="checklist-check">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => handleToggle(item)}
                disabled={loading === item._id}
                aria-label={`Toggle ${item.text}`}
              />
              <span className="checklist-checkmark" />
            </label>
            <span className="checklist-text">{item.text}</span>
            <button
              className="icon-btn danger checklist-remove"
              onClick={() => handleRemove(item._id)}
              aria-label={`Remove ${item.text}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="checklist-add">
        <input
          className="input"
          placeholder="Add an item…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKey}
          aria-label="New checklist item"
        />
      </div>
    </div>
  );
}
