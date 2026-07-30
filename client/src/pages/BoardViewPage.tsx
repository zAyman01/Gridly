import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router";
import { boardsApi, analyticsApi } from "../api";
import { getSocket, joinBoard, leaveBoard, onBoardChange } from "../socket";
import TaskDetailModal from "../components/TaskDetailModal";
import MemberManagementModal from "../components/MemberManagementModal";
import ActivityPanel from "../components/ActivityPanel";
import BoardSettingsModal from "../components/BoardSettingsModal";
import ThemeToggle from "../components/ThemeToggle";
import { CommandPaletteTrigger } from "../components/CommandPalette";
import ViewSwitcher, { type ViewType } from "../components/ViewSwitcher";
import KanbanView, { stationColor } from "./views/KanbanView";
import TableView from "./views/TableView";
import CalendarView from "./views/CalendarView";
import TimelineView from "./views/TimelineView";
import { AnalyticsSkeleton, AnalyticsFault } from "../components/AnalyticsStates";
import { getAvatarColor, getInitials } from "../lib/identity";
import type { Board, List, Task, AnalyticsData } from "../types";
import { useAuth } from "../auth";
import { usePollingFallback } from "../hooks/usePollingFallback";

import "./BoardViewPage.css";

// Recharts is the heaviest thing the board can pull in, and most sessions
// never open the analytics tab. It loads when that tab does.
const AnalyticsDashboard = lazy(() => import("../components/AnalyticsDashboard"));

function Icon({ path, size = 14 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

export default function BoardViewPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [tasksByList, setTasksByList] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>("kanban");

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsFailed, setAnalyticsFailed] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const data = await boardsApi.getDetail(boardId);
      setBoard(data.board);
      setLists(data.lists);
      setTasksByList(data.tasksByList);
      setFetchError("");
    } catch {
      setFetchError("This board didn't load. It may have been deleted.");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  useEffect(() => {
    if (!boardId || !user) return;
    const token = localStorage.getItem("gridly_accessToken");
    if (!token) return;
    getSocket(token);
    joinBoard(boardId);
    const unsub = onBoardChange(() => fetchBoard());
    return () => { leaveBoard(boardId); unsub(); };
  }, [boardId, user, fetchBoard]);

  const loadAnalytics = useCallback(() => {
    if (!boardId) return;
    setLoadingAnalytics(true);
    setAnalyticsFailed(false);
    analyticsApi.getBoardAnalytics(boardId)
      .then(setAnalytics)
      .catch(() => setAnalyticsFailed(true))
      .finally(() => setLoadingAnalytics(false));
  }, [boardId]);

  useEffect(() => {
    if (activeView === "analytics" && !analytics && !loadingAnalytics && !analyticsFailed) {
      loadAnalytics();
    }
  }, [activeView, analytics, loadingAnalytics, analyticsFailed, loadAnalytics]);

  usePollingFallback(fetchBoard);

  const filterFn = useCallback((task: Task) => {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    return true;
  }, [searchQuery, filterPriority]);

  const hasActiveFilters = Boolean(searchQuery || filterPriority);

  const allTasks = useMemo(() => lists.flatMap((l) => tasksByList[l._id] || []), [lists, tasksByList]);

  if (loading) {
    return (
      <div className="bv">
        <header className="app-bar">
          <div className="skeleton" style={{ height: "18px", width: "220px" }} />
        </header>
        <div className="board-layout">
          {[0, 1, 2].map((i) => (
            <div className="column" key={i} style={{ ["--station-color" as string]: stationColor(i, 3) }}>
              <span className="column-station" aria-hidden="true" />
              <div className="column-plate">
                <div className="column-header">
                  <div className="skeleton" style={{ height: "12px", width: "84px" }} />
                </div>
                <div className="column-body">
                  <div className="skeleton" style={{ height: "56px" }} />
                  <div className="skeleton" style={{ height: "56px" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bv bv-fault gridfield">
        <span className="eyebrow">Not loaded</span>
        <p className="bv-fault-text">{fetchError}</p>
        <button className="btn btn-primary btn-md" onClick={() => navigate("/workspaces")}>
          Back to your workspaces
        </button>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="bv">
      <header className="app-bar bv-bar">
        <div className="bv-bar-left">
          <button
            className="bv-back"
            onClick={() => {
              const ws = board.workspace as any;
              navigate(ws && ws.slug ? `/w/${ws.slug}` : "/workspaces");
            }}
          >
            <Icon path={<polyline points="15 18 9 12 15 6" />} size={15} />
            <span className="bv-back-label">Boards</span>
          </button>
          <h1 className="bv-title">{board.title}</h1>
          <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Board settings">
            <Icon path={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>} />
          </button>
        </div>

        <ViewSwitcher activeView={activeView} onChangeView={setActiveView} />

        <div className="bv-bar-right">
          <div className="bv-search">
            <Icon path={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} size={13} />
            <input
              className="input"
              placeholder="Search cards"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search cards"
            />
          </div>
          <select
            className="input select-input bv-filter"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {hasActiveFilters && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearchQuery(""); setFilterPriority(""); }}
            >
              Clear
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowActivity(true)}>
            <Icon path={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />} size={13} />
            <span className="bv-btn-label">Activity</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowMembers(true)}>
            <Icon path={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>} size={13} />
            <span className="bv-btn-label">Members</span>
          </button>
          <div className="avatar-stack bv-avatars">
            {board.members.slice(0, 5).map((m) => {
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
          <CommandPaletteTrigger />
          <ThemeToggle />
        </div>
      </header>

      <div className="bv-view-container">
        {activeView === "kanban" && (
          <KanbanView
            boardId={boardId!}
            lists={lists}
            setLists={setLists}
            tasksByList={tasksByList}
            setTasksByList={setTasksByList}
            fetchBoard={fetchBoard}
            filterFn={filterFn}
            hasActiveFilters={hasActiveFilters}
            onSelectTask={setSelectedTask}
          />
        )}
        {activeView === "table" && (
          <TableView boardId={boardId!} lists={lists} tasksByList={tasksByList} filterFn={filterFn} onSelectTask={setSelectedTask} fetchBoard={fetchBoard} />
        )}
        {activeView === "calendar" && (
          <CalendarView boardId={boardId!} lists={lists} tasksByList={tasksByList} filterFn={filterFn} onSelectTask={setSelectedTask} fetchBoard={fetchBoard} />
        )}
        {activeView === "timeline" ? (
          <TimelineView boardId={boardId!} lists={lists} tasksByList={tasksByList} filterFn={filterFn} onSelectTask={setSelectedTask} fetchBoard={fetchBoard} />
        ) : activeView === "analytics" ? (
          <div className="bv-analytics">
            <div className="bv-analytics-inner">
              {loadingAnalytics ? (
                <AnalyticsSkeleton />
              ) : analytics ? (
                <Suspense fallback={<AnalyticsSkeleton />}>
                  <AnalyticsDashboard data={analytics} title={board.title} />
                </Suspense>
              ) : (
                <AnalyticsFault onRetry={loadAnalytics} />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedTask && boardId && (
        <TaskDetailModal
          task={selectedTask}
          boardId={boardId}
          members={board.members}
          customFields={board.customFields}
          boardTasks={allTasks}
          onClose={() => setSelectedTask(null)}
          onSaved={() => { setSelectedTask(null); fetchBoard(); }}
          onDeleted={() => { setSelectedTask(null); fetchBoard(); }}
        />
      )}

      {showActivity && boardId && (
        <ActivityPanel boardId={boardId} onClose={() => setShowActivity(false)} />
      )}

      {showMembers && boardId && user && (
        <MemberManagementModal
          boardId={boardId}
          members={board.members}
          currentUserId={user._id}
          onClose={() => setShowMembers(false)}
          onChanged={() => { setShowMembers(false); fetchBoard(); }}
        />
      )}

      {showSettings && boardId && (
        <BoardSettingsModal
          board={board}
          boardId={boardId}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); fetchBoard(); }}
        />
      )}
    </div>
  );
}

