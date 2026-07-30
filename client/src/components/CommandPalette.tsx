import { useState, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { workspaceApi, boardsApi } from "../api";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { Workspace, Board } from "../types";

import "./CommandPalette.css";

interface PaletteItem {
  id: string;
  title: string;
  sub: string;
  section: "Actions" | "Workspaces" | "Boards";
  badge?: string;
  action: () => void;
}

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      className="cmd-k-pill"
      onClick={() => window.dispatchEvent(new CustomEvent("open-cmd-k"))}
      aria-label="Open command palette"
    >
      <span>Search...</span>
      <span className="cmd-k-pill-key">⌘K</span>
    </button>
  );
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);

  const { isAuth, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const trapRef = useFocusTrap(open);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-cmd-k", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-cmd-k", handleOpenEvent);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      inputRef.current?.focus();
      if (isAuth) {
        workspaceApi.list().then(setWorkspaces).catch(() => {});
        boardsApi.list().then(setBoards).catch(() => {});
      }
    }
  }, [open, isAuth]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      {
        id: "act-theme",
        title: "Toggle theme",
        sub: `Switch to ${theme === "light" ? "dark" : "light"} mode`,
        section: "Actions",
        badge: "Theme",
        action: () => {
          toggle();
          setOpen(false);
        },
      },
      {
        id: "act-workspaces",
        title: "Go to Workspaces",
        sub: "View all workspaces dashboard",
        section: "Actions",
        badge: "Navigation",
        action: () => {
          navigate("/workspaces");
          setOpen(false);
        },
      },
      {
        id: "act-home",
        title: "Home page",
        sub: "Back to landing page",
        section: "Actions",
        badge: "Navigation",
        action: () => {
          navigate("/");
          setOpen(false);
        },
      },
    ];

    if (isAuth) {
      list.push({
        id: "act-logout",
        title: "Log out",
        sub: "End your session",
        section: "Actions",
        badge: "Auth",
        action: () => {
          logout();
          navigate("/");
          setOpen(false);
        },
      });
    }

    workspaces.forEach((ws) => {
      list.push({
        id: `ws-${ws._id}`,
        title: ws.name,
        sub: "Workspace",
        section: "Workspaces",
        badge: "Workspace",
        action: () => {
          navigate(`/w/${ws.slug}`);
          setOpen(false);
        },
      });
    });

    boards.forEach((b) => {
      list.push({
        id: `board-${b._id}`,
        title: b.title,
        sub: b.description || "Board",
        section: "Boards",
        badge: "Board",
        action: () => {
          navigate(`/boards/${b._id}`);
          setOpen(false);
        },
      });
    });

    return list;
  }, [theme, isAuth, workspaces, boards, toggle, navigate, logout]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.sub.toLowerCase().includes(q) ||
        it.section.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {
      Actions: [],
      Workspaces: [],
      Boards: [],
    };
    filteredItems.forEach((it) => {
      groups[it.section]?.push(it);
    });
    return groups;
  }, [filteredItems]);

  function handleModalKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredItems[selectedIndex];
      if (target) target.action();
    }
  }

  if (!open) return null;

  return (
    <div
      className="cmd-k-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        ref={trapRef}
        className="cmd-k-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleModalKeyDown}
      >
        <div className="cmd-k-input-bar">
          <svg
            className="cmd-k-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-k-input"
            type="text"
            placeholder="Search commands, workspaces, and boards..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command search input"
          />
          <span className="cmd-k-esc">ESC</span>
        </div>

        <div className="cmd-k-body" role="listbox">
          {filteredItems.length === 0 ? (
            <div className="cmd-k-empty">No matching commands or items</div>
          ) : (
            Object.entries(groupedItems).map(([section, group]) => {
              if (group.length === 0) return null;
              return (
                <div key={section} className="cmd-k-section">
                  <div className="cmd-k-section-title">{section}</div>
                  {group.map((it) => {
                    const idx = filteredItems.findIndex((x) => x.id === it.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`cmd-k-item ${isSelected ? "is-selected" : ""}`}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => it.action()}
                      >
                        <div className="cmd-k-item-left">
                          <span className="cmd-k-item-title">{it.title}</span>
                          <span className="cmd-k-item-sub">{it.sub}</span>
                        </div>
                        {it.badge && <span className="cmd-k-badge">{it.badge}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
