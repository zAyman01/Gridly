import { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="md-editor">
      <div className="md-editor-tabs">
        <button
          className={`md-tab ${!preview ? "active" : ""}`}
          onClick={() => setPreview(false)}
          type="button"
        >
          Write
        </button>
        <button
          className={`md-tab ${preview ? "active" : ""}`}
          onClick={() => setPreview(true)}
          type="button"
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="md-preview">
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="meta-text">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          className="textarea md-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Write with **markdown**…"}
          rows={5}
        />
      )}

      {!preview && (
        <p className="md-hint meta-text">
          Supports **bold**, *italic*, `code`, [links](url), lists, and more.
        </p>
      )}
    </div>
  );
}
