import { useState, useEffect, useRef, useCallback } from "react";
import { membersApi, usersApi } from "../api";
import type { BoardMember, User } from "../types";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { getAvatarColor, getInitials } from "../lib/identity";

interface Props {
  boardId: string;
  members: BoardMember[];
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void;
}

function resolveUser(user: string | User): User | null {
  if (typeof user === "string") return null;
  return user;
}

export default function MemberManagementModal({ boardId, members, currentUserId, onClose, onChanged }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusRef = useFocusTrap(true);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await usersApi.search(q);
        const existingIds = members.map((m) => typeof m.user === "string" ? m.user : m.user._id);
        setSearchResults(results.filter((u) => !existingIds.includes(u._id)));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }, [members]);

  function report(err: unknown, fallback: string) {
    console.error(err);
    setError(err instanceof Error ? err.message : fallback);
  }

  async function handleAddMember() {
    if (!selectedUser) return;
    setAdding(true);
    setError("");
    try {
      await membersApi.add(boardId, selectedUser._id, inviteRole);
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
      onChanged();
    } catch (err) { report(err, "Could not add that member"); }
    setAdding(false);
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this board?`)) return;
    setError("");
    try {
      await membersApi.remove(boardId, userId);
      onChanged();
    } catch (err) { report(err, "Could not remove that member"); }
  }

  async function handleChangeRole(userId: string, role: "editor" | "viewer") {
    setError("");
    try {
      await membersApi.updateRole(boardId, userId, role);
      onChanged();
    } catch (err) { report(err, "Could not change that role"); }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel" ref={focusRef as any} role="dialog" aria-modal="true" aria-labelledby="members-title">
        <div className="modal-head">
          <h2 id="members-title" className="modal-title">Members</h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close">&times;</button>
        </div>

        {error && <div className="error-banner mb-3" role="alert">{error}</div>}

        {/* Invite section */}
        <div className="member-invite">
          <label htmlFor="member-search" className="field-label">Invite by email</label>
          <input
            ref={searchRef}
            id="member-search"
            className="input mb-2"
            placeholder="Start typing an email"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && <p className="meta-text mb-1">Searching…</p>}
          {searchResults.length > 0 && (
            <div className="mb-2" style={{ maxHeight: "120px", overflowY: "auto" }}>
              {searchResults.map((u) => (
                <div
                  key={u._id}
                  className={`assignee-option ${selectedUser?._id === u._id ? "selected" : ""}`}
                  onClick={() => setSelectedUser(u)}
                >
                  <div className="avatar avatar-sm" style={{ background: getAvatarColor(u._id), borderWidth: "1px" }}>
                    {getInitials(u.name)}
                  </div>
                  <div className="ml-1">
                    <span className="body-text text-sm block">{u.name}</span>
                    <span className="meta-text">{u.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedUser && (
            <div className="flex items-center gap-2 mt-2">
              <span className="body-text text-sm">{selectedUser.name}</span>
              <select
                className="input select-input"
                style={{ width: "auto" }}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                aria-label="Role for the invited member"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={adding}>
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          )}
        </div>

        {/* Current members */}
        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          {members.map((m) => {
            const user = resolveUser(m.user);
            const uid = user ? user._id : (m.user as string);
            const name = user ? user.name : "Unknown";
            const email = user?.email || "";
            return (
              <div key={uid} className="assignee-option">
                <div className="avatar" style={{ background: getAvatarColor(uid) }}>
                  {getInitials(name)}
                </div>
                <div className="ml-2 flex-1 min-w-0">
                  <span className="body-text text-sm block">
                    {name}
                    {uid === currentUserId && <span className="meta-text ml-1">you</span>}
                  </span>
                  {email && <span className="meta-text block truncate">{email}</span>}
                </div>
                {m.role === "owner" ? (
                  <span className="label-chip">
                    <span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-violet)" }} />
                    Owner
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <select
                      className="input select-input member-role"
                      value={m.role}
                      onChange={(e) => handleChangeRole(uid, e.target.value as "editor" | "viewer")}
                      aria-label={`Role for ${name}`}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      className="icon-btn danger"
                      onClick={() => handleRemoveMember(uid, name)}
                      aria-label={`Remove ${name} from this board`}
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
