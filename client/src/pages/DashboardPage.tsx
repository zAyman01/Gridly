import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { workspaceApi } from "../api";
import Wordmark from "../components/Wordmark";
import ThemeToggle from "../components/ThemeToggle";
import { CommandPaletteTrigger } from "../components/CommandPalette";
import { getAvatarColor, getBoardAccent, getInitials } from "../lib/identity";
import type { Workspace } from "../types";

import "./DashboardPage.css";

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const members = workspace.members;
  return (
    <Link
      to={`/w/${workspace.slug}`}
      className="board-card"
      style={{ ["--board-accent" as string]: getBoardAccent(workspace._id) }}
    >
      <h3 className="board-card-title">{workspace.name}</h3>
      <div className="board-card-footer">
        <div className="avatar-stack">
          {members.slice(0, 4).map((m) => {
            const uid = typeof m.user === "string" ? m.user : m.user._id;
            const name = typeof m.user === "string" ? "" : m.user.name;
            return (
              <div
                key={uid}
                className="avatar avatar-sm"
                style={{ background: getAvatarColor(uid) }}
                title={name}
              >
                {getInitials(name || "?")}
              </div>
            );
          })}
        </div>
        <span className="meta-text">
          {String(members.length).padStart(2, "0")} {members.length === 1 ? "member" : "members"}
        </span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    workspaceApi.list().then(setWorkspaces).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    if (showUserMenu) window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [showUserMenu]);

  // Auto-generate slug from name
  useEffect(() => {
    setNewSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  }, [newName]);

  async function handleCreateWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;
    try {
      const ws = await workspaceApi.create({ name: newName, slug: newSlug });
      navigate(`/w/${ws.slug}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create workspace. Slug might be taken.");
    }
  }

  return (
    <div className="dash">
      <header className="app-bar">
        <div className="dash-bar-left">
          <Wordmark />
          <span className="dash-crumb">Workspaces</span>
        </div>
        <div className="dash-bar-right">
          <CommandPaletteTrigger />
          <ThemeToggle />
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            New Workspace
          </button>
          {user && (
            <div className="dash-user" ref={menuRef}>
              <button
                className="avatar"
                style={{ background: getAvatarColor(user._id), cursor: "pointer" }}
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
              >
                {getInitials(user.name)}
              </button>
              {showUserMenu && (
                <div className="menu-plate" role="menu">
                  <div className="dash-user-head">
                    <div className="dash-user-name">{user.name}</div>
                    <div className="meta-text">{user.email}</div>
                  </div>
                  <button onClick={() => { logout(); navigate("/"); }} className="menu-item" role="menuitem">
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-head">
          <div>
            <span className="eyebrow">Your workspaces</span>
            <h1 className="dash-title">Everything you're running</h1>
          </div>
          <span className="dash-count mono-text">
            {loading ? "—" : String(workspaces.length).padStart(2, "0")}
          </span>
        </div>

        {showCreate && (
          <form onSubmit={handleCreateWorkspace} className="dash-create">
            <span className="field-label">New workspace</span>
            <input
              className="input"
              placeholder="Workspace Name (e.g. Acme Corp)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              required
            />
            <input
              className="input"
              placeholder="Workspace Slug (e.g. acme-corp)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              required
            />
            <div className="dash-create-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={!newName.trim() || !newSlug.trim()}>
                Create workspace
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="dash-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="dash-skeleton">
                <div className="skeleton" style={{ height: "18px", width: "62%" }} />
                <div className="skeleton" style={{ height: "12px", width: "84%" }} />
              </div>
            ))}
          </div>
        ) : workspaces.length === 0 && !showCreate ? (
          <div className="dash-empty gridfield">
            <h2 className="dash-empty-title">No workspaces yet</h2>
            <p className="dash-empty-text">
              A workspace holds all your boards. Create one to get started.
            </p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-md">
              Create your first workspace
            </button>
          </div>
        ) : (
          <div className="dash-grid">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws._id} workspace={ws} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
