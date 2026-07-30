import { useState, useEffect, useRef, useCallback } from "react";
import { attachmentsApi } from "../api";
import type { Attachment, User } from "../types";

interface Props {
  boardId: string;
  taskId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function resolveUploader(uploader: string | User): { name: string } {
  if (typeof uploader === "string") return { name: "Unknown" };
  return { name: uploader.name };
}

export default function AttachmentZone({ boardId, taskId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    attachmentsApi.list(boardId, taskId).then(setAttachments).catch(console.error);
  }, [boardId, taskId]);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await attachmentsApi.upload(boardId, taskId, file);
        setAttachments((prev) => [attachment, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, [boardId, taskId]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleDelete(attachmentId: string) {
    if (!window.confirm("Delete this attachment?")) return;
    try {
      await attachmentsApi.delete(boardId, taskId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a._id !== attachmentId));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="attachment-zone">
      <span className="field-label">Attachments ({attachments.length})</span>

      <div
        className={`attachment-dropzone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleUpload(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <span className="attachment-drop-text">Uploading…</span>
        ) : (
          <>
            <span className="attachment-drop-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <span className="attachment-drop-text">
              Drop files here or <span className="attachment-drop-link">browse</span>
            </span>
          </>
        )}
      </div>

      {attachments.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((att) => {
            const uploader = resolveUploader(att.uploader);
            return (
              <li key={att._id} className="attachment-item">
                {isImage(att.mimeType) ? (
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-thumb">
                    <img src={att.url} alt={att.filename} loading="lazy" />
                  </a>
                ) : (
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-file-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </a>
                )}
                <div className="attachment-info">
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-name">
                    {att.filename}
                  </a>
                  <span className="meta-text">
                    {formatSize(att.sizeBytes)} · {uploader.name}
                  </span>
                </div>
                <button
                  className="icon-btn danger"
                  onClick={() => handleDelete(att._id)}
                  aria-label={`Delete ${att.filename}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
