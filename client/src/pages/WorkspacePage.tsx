import { useState, useEffect, useRef, useCallback, lazy, Suspense, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAuth } from "../auth";
import { workspaceApi, boardsApi, analyticsApi } from "../api";
import Wordmark from "../components/Wordmark";
import ThemeToggle from "../components/ThemeToggle";
import { CommandPaletteTrigger } from "../components/CommandPalette";
import { AnalyticsSkeleton, AnalyticsFault } from "../components/AnalyticsStates";
import { getAvatarColor, getBoardAccent, getInitials } from "../lib/identity";
import type { Workspace, Board, AnalyticsData } from "../types";

import "./DashboardPage.css"; // Reuse dashboard styles for now

// Same reasoning as the board: the charts load with the analytics tab.
const AnalyticsDashboard = lazy(() => import("../components/AnalyticsDashboard"));

function BoardCard({ board }: { board: Board }) {
  const members = board.members;
  return (
    <Link
      to={`/boards/${board._id}`}
      className="board-card"
      style={{ ["--board-accent" as string]: getBoardAccent(board._id) }}
    >
      <h3 className="board-card-title">{board.title}</h3>
      {board.description && <p className="board-card-desc">{board.description}</p>}
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

export default function WorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, logout } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = useState<"boards" | "analytics">("boards");
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsFailed, setAnalyticsFailed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setLoadError("");
    workspaceApi.get(slug).then((res) => {
      setWorkspace(res.workspace);
      setBoards(res.boards);
    }).catch((err) => {
      console.error(err);
      setLoadError("That workspace didn't load. It may have been deleted, or you may no longer be a member.");
    }).finally(() => setLoading(false));
  }, [slug]);

  const loadAnalytics = useCallback(() => {
    if (!slug) return;
    setLoadingAnalytics(true);
    setAnalyticsFailed(false);
    analyticsApi.getWorkspaceAnalytics(slug)
      .then(setAnalytics)
      .catch(() => setAnalyticsFailed(true))
      .finally(() => setLoadingAnalytics(false));
  }, [slug]);

  useEffect(() => {
    if (activeTab === "analytics" && !analytics && !loadingAnalytics && !analyticsFailed) {
      loadAnalytics();
    }
  }, [activeTab, analytics, loadingAnalytics, analyticsFailed, loadAnalytics]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    if (showUserMenu) window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [showUserMenu]);

  async function handleCreateBoard(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !workspace) return;
    setCreateError("");
    try {
      const board = await boardsApi.create({ title: newTitle, description: newDesc || undefined, workspace: workspace._id });
      navigate(`/boards/${board._id}`);
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Could not create that board");
    }
  }

  return (
    <div className="dash">
      <header className="app-bar">
        <div className="dash-bar-left">
          <Wordmark />
          <span className="dash-crumb"><Link to="/workspaces">Workspaces</Link></span>
          <span className="dash-crumb-sep">/</span>
          <span className="dash-crumb">{workspace?.name || "..."}</span>
        </div>
        <div className="dash-bar-right">
          <CommandPaletteTrigger />
          <ThemeToggle />
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">
            New board
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
            <span className="eyebrow">Workspace</span>
            <h1 className="dash-title">{workspace?.name || "…"}</h1>
          </div>
          <div className="ws-tabs">
            <button
              className={`btn ${activeTab === "boards" ? "btn-primary" : "btn-secondary"} btn-sm`}
              onClick={() => setActiveTab("boards")}
            >
              Boards
            </button>
            <button
              className={`btn ${activeTab === "analytics" ? "btn-primary" : "btn-secondary"} btn-sm`}
              onClick={() => setActiveTab("analytics")}
            >
              Analytics
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="dash-empty gridfield">
            <h2 className="dash-empty-title">Workspace not available</h2>
            <p className="dash-empty-text">{loadError}</p>
            <Link to="/workspaces" className="btn btn-primary btn-md">Back to your workspaces</Link>
          </div>
        ) : activeTab === "boards" ? (
          loading ? (
            <div className="dash-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="dash-skeleton">
                  <div className="skeleton" style={{ height: "18px", width: "62%" }} />
                  <div className="skeleton" style={{ height: "12px", width: "84%" }} />
                </div>
              ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="dash-empty gridfield">
              <h2 className="dash-empty-title">No boards yet</h2>
              <p className="dash-empty-text">A board holds your columns and cards. Create the first one.</p>
              <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-md">
                Create your first board
              </button>
            </div>
          ) : (
            <div className="dash-grid">
              {boards.map((b) => (
                <BoardCard key={b._id} board={b} />
              ))}
            </div>
          )
        ) : (
          loadingAnalytics ? (
            <AnalyticsSkeleton />
          ) : analytics ? (
            <Suspense fallback={<AnalyticsSkeleton />}>
              <AnalyticsDashboard data={analytics} title={workspace?.name ?? "Analytics"} />
            </Suspense>
          ) : (
            <AnalyticsFault onRetry={loadAnalytics} />
          )
        )}
      </main>

      {showCreate && workspace && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="new-board-heading">
            <div className="modal-head">
              <h2 id="new-board-heading" className="modal-title">New board</h2>
              <button className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Close">&times;</button>
            </div>
            <form onSubmit={handleCreateBoard}>
              {createError && <div className="error-banner" role="alert">{createError}</div>}
              <div className="modal-section">
                <label className="field-label" htmlFor="new-board-title">Title</label>
                <input
                  id="new-board-title"
                  className="input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Marketing campaign"
                  autoFocus
                  required
                />
              </div>
              <div className="modal-section">
                <label className="field-label" htmlFor="new-board-desc">Description (optional)</label>
                <textarea
                  id="new-board-desc"
                  className="textarea"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this board for?"
                  rows={3}
                />
              </div>
              <div className="modal-foot" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!newTitle.trim()}>Create board</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
