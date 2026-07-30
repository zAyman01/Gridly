import { useState, useEffect, useCallback } from "react";
import { activityApi } from "../api";
import { onBoardChange } from "../socket";
import type { ActivityLogItem, User } from "../types";
import { getAvatarColor, getInitials } from "../lib/identity";

interface Props {
  boardId: string;
  onClose: () => void;
}

function resolveUser(user: string | User): User | null {
  if (typeof user === "string") return null;
  return user;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatAction(item: ActivityLogItem): string {
  const user = resolveUser(item.user);
  const userName = user?.name || "Someone";
  const details = item.details || {};

  switch (item.action) {
    case "board.created":
      return `${userName} created this board`;
    case "board.updated":
      return `${userName} updated the board`;
    case "board.deleted":
      return `${userName} deleted this board`;
    case "list.created":
      return `${userName} added "${details.title}" column`;
    case "list.updated":
      return `${userName} renamed "${details.oldTitle}" to "${details.newTitle}"`;
    case "list.deleted":
      return `${userName} deleted "${details.title}" column`;
    case "list.reordered":
      return `${userName} reordered columns`;
    case "task.created":
      return `${userName} created "${details.title}"`;
    case "task.updated":
      return `${userName} updated "${details.title}"`;
    case "task.deleted":
      return `${userName} deleted "${details.title}"`;
    case "task.moved":
      return `${userName} moved "${details.title}"`;
    case "member.added":
      return `${userName} added ${details.memberName || "a member"}`;
    case "member.removed":
      return `${userName} removed a member`;
    case "member.role_updated":
      return `${userName} changed a member's role to ${details.newRole}`;
    case "comment.created":
      return `${userName} commented: "${details.preview}"`;
    case "attachment.uploaded":
      return `${userName} attached ${details.filename}`;
    case "attachment.deleted":
      return `${userName} removed ${details.filename}`;
    case "ai.description_drafted":
      return `${userName} drafted a description for "${details.title}" with AI`;
    case "ai.checklist_generated":
      return `${userName} generated ${details.count} checklist steps with AI`;
    default:
      return `${userName} performed ${item.action}`;
  }
}

export default function ActivityPanel({ boardId, onClose }: Props) {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await activityApi.list(boardId);
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [boardId]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  useEffect(() => {
    const unsub = onBoardChange(() => fetchActivity());
    return unsub;
  }, [fetchActivity]);

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="activity-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="activity-panel" role="complementary" aria-label="Activity log">
        <div className="modal-head">
          <h2 className="modal-title">Activity</h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close activity panel">&times;</button>
        </div>

        {loading ? (
          <p className="meta-text">Reading the tape…</p>
        ) : logs.length === 0 ? (
          <p className="meta-text">Nothing has happened on this board yet.</p>
        ) : (
          <div>
            {logs.map((log) => {
              const user = resolveUser(log.user);
              const uid = user ? user._id : (log.user as string);
              const name = user?.name || "?";
              return (
                <div key={log._id} className="activity-item">
                  <div className="avatar avatar-sm" style={{ background: getAvatarColor(uid) }}>
                    {getInitials(name)}
                  </div>
                  <div className="min-w-0">
                    <p className="body-text text-sm">{formatAction(log)}</p>
                    <span className="meta-text">{timeAgo(log.createdAt)}</span>
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
