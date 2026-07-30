export type ViewType = "kanban" | "table" | "calendar" | "timeline" | "analytics";

interface Props {
  activeView: ViewType;
  onChangeView: (view: ViewType) => void;
}

export default function ViewSwitcher({ activeView, onChangeView }: Props) {
  const views: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    {
      id: "kanban",
      label: "Board",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      )
    },
    {
      id: "table",
      label: "Table",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      )
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12" />
          <polyline points="15 6 21 12 15 18" />
        </svg>
      )
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    }
  ];

  return (
    // A group, not a tablist: these swap the whole canvas rather than
    // panels inside one container, and each label is visible, so the
    // buttons carry aria-pressed instead of a redundant aria-label.
    <div className="view-switcher" role="group" aria-label="Board view">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`view-switcher-btn ${activeView === view.id ? "active" : ""}`}
          onClick={() => onChangeView(view.id)}
          aria-pressed={activeView === view.id}
        >
          <span aria-hidden="true">{view.icon}</span>
          <span>{view.label}</span>
        </button>
      ))}
    </div>
  );
}
