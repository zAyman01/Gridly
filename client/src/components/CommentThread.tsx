import { useState, useEffect, useRef } from "react";
import { commentsApi, usersApi } from "../api";
import { useAuth } from "../auth";
import { getAvatarColor, getInitials } from "../lib/identity";
import type { Comment, User } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface Props {
  boardId: string;
  taskId: string;
}

function resolveAuthor(author: string | User): { id: string; name: string } {
  if (typeof author === "string") return { id: author, name: "Unknown" };
  return { id: author._id, name: author.name };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CommentThread({ boardId, taskId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  // @mention state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    commentsApi.list(boardId, taskId).then(setComments).catch(console.error);
  }, [boardId, taskId]);

  // Search for @mentions
  useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 2) {
      setMentionResults([]);
      setShowMentions(false);
      return;
    }
    const timer = setTimeout(() => {
      usersApi.search(mentionQuery).then((users) => {
        setMentionResults(users);
        setShowMentions(users.length > 0);
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [mentionQuery]);

  function handleBodyChange(value: string) {
    setBody(value);
    // Detect @mention trigger
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/@(\w+)$/);
    if (match) {
      setMentionQuery(match[1]!);
    } else {
      setMentionQuery("");
      setShowMentions(false);
    }
  }

  function insertMention(mentionUser: User) {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const beforeCursor = body.slice(0, cursor);
    const afterCursor = body.slice(cursor);
    const replaced = beforeCursor.replace(/@\w+$/, `@${mentionUser.name} `);
    setBody(replaced + afterCursor);
    setShowMentions(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      // Extract @mentions from body
      const mentionMatches = trimmed.match(/@\w+/g) || [];
      const mentions = mentionMatches.map((m) => m.slice(1));
      const comment = await commentsApi.create(boardId, taskId, { body: trimmed, mentions });
      setComments((prev) => [...prev, comment]);
      setBody("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  async function handleUpdate(commentId: string) {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    try {
      const updated = await commentsApi.update(boardId, taskId, commentId, { body: trimmed });
      setComments((prev) => prev.map((c) => (c._id === commentId ? updated : c)));
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await commentsApi.delete(boardId, taskId, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="comment-thread">
      <span className="field-label">Comments ({comments.length})</span>

      {comments.length === 0 && (
        <p className="meta-text comment-empty">No comments yet. Start the conversation.</p>
      )}

      <div className="comment-list">
        {comments.map((comment) => {
          const author = resolveAuthor(comment.author);
          const isOwn = user?._id === author.id;

          return (
            <div key={comment._id} className="comment-item">
              <div
                className="avatar comment-avatar"
                style={{ background: getAvatarColor(author.id) }}
              >
                {getInitials(author.name)}
              </div>
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-author">{author.name}</span>
                  <span className="meta-text">{timeAgo(comment.createdAt)}</span>
                  {isOwn && (
                    <div className="comment-actions">
                      <button
                        className="icon-btn"
                        onClick={() => { setEditingId(comment._id); setEditBody(comment.body); }}
                        aria-label="Edit comment"
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(comment._id)}
                        aria-label="Delete comment"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment._id ? (
                  <div className="comment-edit">
                    <textarea
                      className="textarea"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={2}
                    />
                    <div className="comment-edit-actions">
                      <button className="btn btn-primary btn-xs" onClick={() => handleUpdate(comment._id)}>Save</button>
                      <button className="btn btn-secondary btn-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-content">
                    <MarkdownRenderer content={comment.body} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="comment-compose">
        <div className="comment-compose-wrap">
          <textarea
            ref={textareaRef}
            className="textarea"
            placeholder="Write a comment… Use @name to mention"
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={2}
          />
          {showMentions && (
            <div className="mention-dropdown">
              {mentionResults.map((u) => (
                <button
                  key={u._id}
                  className="mention-option"
                  onClick={() => insertMention(u)}
                >
                  <div
                    className="avatar avatar-xs"
                    style={{ background: getAvatarColor(u._id) }}
                  >
                    {getInitials(u.name)}
                  </div>
                  <span>{u.name}</span>
                  <span className="meta-text">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSubmit}
          disabled={sending || !body.trim()}
        >
          {sending ? "Sending…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
