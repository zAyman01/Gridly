import { useState, useEffect, useRef } from "react";
import { boardsApi } from "../api";
import type { Board, CustomField } from "../types";

const FIELD_TYPES: CustomField["type"][] = ["text", "number", "date", "select", "multiselect", "checkbox"];

interface Props {
  board: Board;
  boardId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function BoardSettingsModal({ board, boardId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description || "");
  const [visibility, setVisibility] = useState<"workspace" | "private">(board.visibility || "workspace");
  const [fields, setFields] = useState<CustomField[]>(board.customFields || []);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomField["type"]>("text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await boardsApi.update(boardId, {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        customFields: fields,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addField() {
    const name = newFieldName.trim();
    if (!name || fields.some((f) => f.name === name)) return;
    const field: CustomField = { name, type: newFieldType };
    if (newFieldType === "select" || newFieldType === "multiselect") field.options = [];
    setFields((prev) => [...prev, field]);
    setNewFieldName("");
  }

  function updateFieldOptions(name: string, raw: string) {
    const options = raw.split(",").map((o) => o.trim()).filter(Boolean);
    setFields((prev) => prev.map((f) => (f.name === name ? { ...f, options } : f)));
  }

  function removeField(name: string) {
    setFields((prev) => prev.filter((f) => f.name !== name));
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-head">
          <h2 id="settings-title" className="modal-title">Board settings</h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close">&times;</button>
        </div>

        {error && (
          <div className="error-banner mb-3" role="alert">{error}</div>
        )}

        <div className="modal-section">
          <label htmlFor="settings-title-input" className="field-label">Title</label>
          <input
            ref={inputRef}
            id="settings-title-input"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="modal-section">
          <label htmlFor="settings-desc-input" className="field-label">Description</label>
          <textarea
            id="settings-desc-input"
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="modal-section">
          <span className="field-label">Visibility</span>
          <div className="option-group">
            <button
              type="button"
              className={`option-btn ${visibility === "workspace" ? "active" : ""}`}
              onClick={() => setVisibility("workspace")}
            >
              Workspace
            </button>
            <button
              type="button"
              className={`option-btn ${visibility === "private" ? "active" : ""}`}
              onClick={() => setVisibility("private")}
            >
              Private
            </button>
          </div>
        </div>

        <div className="modal-section">
          <span className="field-label">Custom fields</span>
          {fields.length > 0 && (
            <ul className="field-schema-list">
              {fields.map((f) => (
                <li className="field-schema-item" key={f.name}>
                  <span className="field-schema-name">{f.name}</span>
                  <span className="label-chip">{f.type}</span>
                  {(f.type === "select" || f.type === "multiselect") && (
                    <input
                      className="input field-schema-options"
                      placeholder="Options, comma separated"
                      value={(f.options || []).join(", ")}
                      onChange={(e) => updateFieldOptions(f.name, e.target.value)}
                      aria-label={`Options for ${f.name}`}
                    />
                  )}
                  <button className="icon-btn danger" onClick={() => removeField(f.name)} aria-label={`Remove ${f.name}`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="field-schema-add">
            <input
              className="input"
              placeholder="Field name"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
              aria-label="New field name"
            />
            <select
              className="input select-input"
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as CustomField["type"])}
              aria-label="New field type"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={addField} disabled={!newFieldName.trim()}>
              Add field
            </button>
          </div>
        </div>

        <div className="modal-foot" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
