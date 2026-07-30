import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { useScrollReveal } from "../hooks/useScrollReveal";
import Wordmark from "../components/Wordmark";
import ThemeToggle from "../components/ThemeToggle";

import "./HomePage.css";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/* ── hero demo data ────────────────────────────────────────── */

const STATIONS = [
  { label: "Queued", color: "var(--color-steel)" },
  { label: "Running", color: "var(--color-signal)" },
  { label: "Cleared", color: "var(--color-clear)" },
];

const POOL = [
  { title: "Rewrite the checkout copy", color: "var(--color-stop)" },
  { title: "Ship board search filters", color: "var(--color-signal)" },
  { title: "Audit viewer permissions", color: "var(--color-steel)" },
  { title: "Add drag-and-drop tests", color: "var(--color-violet)" },
  { title: "Trim the activity payload", color: "var(--color-flow)" },
  { title: "Draft the release note", color: "var(--color-steel)" },
];

interface Slip {
  uid: number;
  poolIdx: number;
  stage: number;
}

const SEED: Slip[] = [
  { uid: 0, poolIdx: 0, stage: 0 },
  { uid: 1, poolIdx: 1, stage: 1 },
  { uid: 2, poolIdx: 2, stage: 1 },
  { uid: 3, poolIdx: 3, stage: 2 },
];

/* ── the same six cards, seen four ways (signature) ────────── */

type ViewKey = "board" | "table" | "calendar" | "timeline";

const VIEW_TABS: { key: ViewKey; label: string; note: string }[] = [
  { key: "board", label: "Board", note: "Columns and drag-and-drop" },
  { key: "table", label: "Table", note: "Every field in one grid" },
  { key: "calendar", label: "Calendar", note: "Due dates on a month" },
  { key: "timeline", label: "Timeline", note: "Duration and blockers" },
];

interface DemoCard {
  id: string;
  title: string;
  list: string;
  stage: number;
  priority: "urgent" | "high" | "medium" | "low";
  lamp: string;
  day: number;      // column in the calendar strip
  start: number;    // timeline offset, in day cells
  span: number;     // timeline length, in day cells
  who: string;
  blocked?: boolean;
}

const CARDS: DemoCard[] = [
  { id: "GR-118", title: "Rewrite the checkout copy", list: "Queued", stage: 0, priority: "high", lamp: "var(--color-signal)", day: 2, start: 0, span: 3, who: "MR" },
  { id: "GR-119", title: "Audit viewer permissions", list: "Queued", stage: 0, priority: "medium", lamp: "var(--color-violet)", day: 4, start: 1, span: 2, who: "AK" },
  { id: "GR-120", title: "Ship board search filters", list: "Running", stage: 1, priority: "urgent", lamp: "var(--color-stop)", day: 6, start: 2, span: 4, who: "JD", blocked: true },
  { id: "GR-121", title: "Add drag-and-drop tests", list: "Running", stage: 1, priority: "medium", lamp: "var(--color-violet)", day: 8, start: 4, span: 3, who: "MR" },
  { id: "GR-122", title: "Trim the activity payload", list: "Cleared", stage: 2, priority: "low", lamp: "var(--color-steel)", day: 9, start: 5, span: 2, who: "AK" },
  { id: "GR-123", title: "Draft the release note", list: "Cleared", stage: 2, priority: "high", lamp: "var(--color-signal)", day: 11, start: 7, span: 2, who: "JD" },
];

const DAY_CELLS = 12;

/* ── page content ──────────────────────────────────────────── */

const ANATOMY = [
  { tag: "Markdown", text: "Descriptions are written and previewed as markdown — headings, lists, code, links." },
  { tag: "Checklist", text: "Break a card into steps and watch the progress bar close as they tick off." },
  { tag: "Custom fields", text: "Define text, number, date, select, multi-select, or checkbox fields per board." },
  { tag: "Dependencies", text: "Say a card blocks another, or is blocked by it. Blocked cards carry a lamp." },
  { tag: "Files", text: "Drop images and documents on the card. They upload straight to the CDN." },
  { tag: "Comments", text: "Discuss on the card, mention a teammate by name, edit or delete your own." },
];

const STEPS = [
  { n: "01", title: "Open a workspace", text: "A workspace groups the boards for one team, one client, or one product." },
  { n: "02", title: "Build the board", text: "Add columns for your stages, then cards for the work. Drag either into place." },
  { n: "03", title: "Bring people in", text: "Invite by email at the level you mean: owner, editor, or viewer." },
  { n: "04", title: "Watch it move", text: "Switch views, read the activity tape, and check velocity in analytics." },
];

const ROLES = [
  { role: "Owner", lamp: "var(--color-signal)", can: "Everything: settings, members, deleting the board" },
  { role: "Editor", lamp: "var(--color-flow)", can: "Cards, columns, comments, files, and adding members" },
  { role: "Viewer", lamp: "var(--color-steel)", can: "Read the board and its history — no edits" },
];

const TAPE = [
  { who: "JD", what: "moved", target: "Ship board search filters", when: "just now", lamp: "var(--color-signal)" },
  { who: "MR", what: "commented on", target: "Rewrite the checkout copy", when: "2m", lamp: "var(--color-violet)" },
  { who: "AK", what: "completed", target: "Trim the activity payload", when: "6m", lamp: "var(--color-clear)" },
  { who: "JD", what: "attached a file to", target: "Draft the release note", when: "11m", lamp: "var(--color-steel)" },
  { who: "MR", what: "invited", target: "sam@acme.co as editor", when: "18m", lamp: "var(--color-flow)" },
];

const AI_STEPS = [
  "Audit the current permission checks",
  "Add a role hierarchy to the guard",
  "Cover viewer, editor, and owner in tests",
  "Update the API reference",
];

const FIGURES = [
  { value: 5, suffix: "", label: "ways to read one board" },
  { value: 4, suffix: "", label: "charts in the dashboard" },
  { value: 3, suffix: "", label: "roles per board" },
  { value: 14, suffix: "d", label: "of velocity, always on" },
];

const FAQ = [
  {
    q: "What is actually in a workspace?",
    a: "Boards. A workspace is the container you share with a team — every board inside it keeps its own members and roles, so one workspace can hold both an open roadmap and a private hiring board.",
  },
  {
    q: "Do the four views hold the same data?",
    a: "Yes. Board, table, calendar, and timeline are four readings of the same cards. Edit a due date in the card and it moves in the calendar and the timeline at once.",
  },
  {
    q: "What does the AI do, and where does my text go?",
    a: "Two things: it drafts a task description from the title, and it breaks a task into checklist steps. Both run on the server against Google Gemini — the API key never reaches the browser, and nothing runs unless you press the button.",
  },
  {
    q: "How do permissions work?",
    a: "Every board member holds one of three roles. Owners run the board, editors change it, viewers read it. The roles are a hierarchy, so an owner can do anything an editor can.",
  },
  {
    q: "Is it live for everyone at once?",
    a: "On a server with WebSockets, changes land on every open board in the same second. Where sockets are unavailable — serverless hosting, for instance — Gridly falls back to polling and keeps working.",
  },
  {
    q: "How is my data protected?",
    a: "Traffic is encrypted with TLS, passwords are hashed with bcrypt, and sessions use a short-lived access token plus a rotating httpOnly refresh cookie.",
  },
];

/* ── hero: a board that runs itself ────────────────────────── */

function LiveBoard() {
  const [slips, setSlips] = useState<Slip[]>(SEED);
  const phase = useRef(0);
  const cursor = useRef(SEED.length);
  const uid = useRef(SEED.length);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const id = window.setInterval(() => {
      const beat = phase.current % 4;
      phase.current += 1;

      if (beat === 0) {
        const poolIdx = cursor.current % POOL.length;
        const nextUid = uid.current;
        cursor.current += 1;
        uid.current += 1;
        setSlips((prev) => (prev.length >= 6 ? prev : [...prev, { uid: nextUid, poolIdx, stage: 0 }]));
        return;
      }

      if (beat === 3) {
        setSlips((prev) => {
          const i = prev.findIndex((s) => s.stage === 2);
          return i < 0 ? prev : prev.filter((_, idx) => idx !== i);
        });
        return;
      }

      const from = beat === 1 ? 0 : 1;
      setSlips((prev) => {
        const i = prev.findIndex((s) => s.stage === from);
        if (i < 0) return prev;
        return prev.map((s, idx) => (idx === i ? { ...s, stage: from + 1 } : s));
      });
    }, 1800);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hp-demo">
      <div className="hp-demo-bar">
        <span className="hp-demo-name">Release 4.2</span>
        <span className="hp-demo-live">
          <span className="lamp" />
          Live
        </span>
      </div>

      <div className="hp-demo-track">
        <div className="hp-demo-rail" aria-hidden="true">
          <span className="hp-demo-pulse" />
        </div>

        <div className="hp-demo-cols">
          {STATIONS.map((station, stage) => {
            const held = slips.filter((s) => s.stage === stage);
            return (
              <div
                className="hp-demo-col"
                key={station.label}
                style={{ ["--station-color" as string]: station.color }}
              >
                <span className="hp-demo-station" aria-hidden="true" />
                <div className="hp-demo-head">
                  <span className="hp-demo-label">{station.label}</span>
                  <span className="hp-demo-count">{String(held.length).padStart(2, "0")}</span>
                </div>
                <div className="hp-demo-stack">
                  {held.map((slip) => {
                    const item = POOL[slip.poolIdx]!;
                    return (
                      <div
                        className="hp-slip"
                        key={slip.uid}
                        style={{ ["--slip-color" as string]: item.color }}
                      >
                        <div className="hp-slip-id">GR-{String(118 + slip.uid).padStart(3, "0")}</div>
                        <div className="hp-slip-title">{item.title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── signature: one board, four readings ───────────────────── */

function ViewStage() {
  const [view, setView] = useState<ViewKey>("board");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setView((current) => {
        const i = VIEW_TABS.findIndex((t) => t.key === current);
        return VIEW_TABS[(i + 1) % VIEW_TABS.length]!.key;
      });
    }, 4200);
    return () => window.clearInterval(id);
  }, [paused]);

  const active = VIEW_TABS.find((t) => t.key === view)!;

  return (
    <div
      className="hp-stage"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hp-stage-bar">
        <div className="hp-stage-tabs" role="tablist" aria-label="Board views">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={view === tab.key}
              className={`hp-stage-tab ${view === tab.key ? "is-active" : ""}`}
              onClick={() => setView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="hp-stage-note">{active.note}</span>
      </div>

      <div className={`hp-stage-body view-${view}`} key={view}>
        {view === "board" && (
          <div className="hp-mini-board">
            {STATIONS.map((station, stage) => (
              <div className="hp-mini-col" key={station.label} style={{ ["--station-color" as string]: station.color }}>
                <div className="hp-mini-col-head">
                  <span className="lamp" style={{ ["--lamp-color" as string]: station.color }} />
                  {station.label}
                </div>
                {CARDS.filter((c) => c.stage === stage).map((card, i) => (
                  <article
                    className="hp-mini-card"
                    key={card.id}
                    style={{ ["--slip-color" as string]: card.lamp, animationDelay: `${i * 60 + stage * 40}ms` }}
                  >
                    <span className="hp-mini-id">{card.id}</span>
                    <span className="hp-mini-title">{card.title}</span>
                    <span className="hp-mini-foot">
                      <span className="hp-mini-who">{card.who}</span>
                      {card.blocked && <span className="hp-mini-flag">blocked</span>}
                    </span>
                  </article>
                ))}
              </div>
            ))}
          </div>
        )}

        {view === "table" && (
          <div className="hp-mini-table" role="table">
            <div className="hp-mini-tr hp-mini-th" role="row">
              <span>Card</span><span>Column</span><span>Priority</span><span>Owner</span>
            </div>
            {CARDS.map((card, i) => (
              <div className="hp-mini-tr" role="row" key={card.id} style={{ animationDelay: `${i * 50}ms` }}>
                <span className="hp-mini-cell-title">
                  <span className="lamp" style={{ ["--lamp-color" as string]: card.lamp }} />
                  {card.title}
                </span>
                <span className="hp-mini-muted">{card.list}</span>
                <span className="hp-mini-muted">{card.priority}</span>
                <span className="hp-mini-who">{card.who}</span>
              </div>
            ))}
          </div>
        )}

        {view === "calendar" && (
          <div className="hp-mini-cal">
            {Array.from({ length: DAY_CELLS }, (_, i) => {
              const dayCards = CARDS.filter((c) => c.day === i);
              return (
                <div className="hp-mini-day" key={i} style={{ animationDelay: `${i * 28}ms` }}>
                  <span className="hp-mini-daynum">{String(i + 12).padStart(2, "0")}</span>
                  {dayCards.map((card) => (
                    <span className="hp-mini-event" key={card.id} style={{ ["--slip-color" as string]: card.lamp }}>
                      {card.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {view === "timeline" && (
          <div className="hp-mini-time">
            {CARDS.map((card, i) => (
              <div className="hp-mini-time-row" key={card.id}>
                <span className="hp-mini-time-label">{card.title}</span>
                <span className="hp-mini-time-track">
                  <span
                    className="hp-mini-time-bar"
                    style={{
                      ["--slip-color" as string]: card.lamp,
                      left: `${(card.start / DAY_CELLS) * 100}%`,
                      width: `${(card.span / DAY_CELLS) * 100}%`,
                      animationDelay: `${i * 70}ms`,
                    }}
                  >
                    {card.blocked ? "blocked" : card.id}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AI panel: a title becoming a checklist ────────────────── */

function AiPanel() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) { setShown(AI_STEPS.length); return; }
    const id = window.setInterval(() => {
      setShown((n) => (n >= AI_STEPS.length ? 0 : n + 1));
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hp-ai">
      <div className="hp-ai-head">
        <span className="hp-ai-label">Card</span>
        <span className="hp-ai-title">Fix the board permission check</span>
      </div>
      <button className="hp-ai-action" type="button" tabIndex={-1} aria-hidden="true">
        Auto-generate steps
      </button>
      <ul className="hp-ai-list">
        {AI_STEPS.map((step, i) => (
          <li className={`hp-ai-item ${i < shown ? "is-in" : ""}`} key={step}>
            <span className="hp-ai-box" />
            {step}
          </li>
        ))}
      </ul>
      <div className="hp-ai-foot">
        <span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-flow)" }} />
        Key stays on the server
      </div>
    </div>
  );
}

/* ── analytics: charts that draw themselves ────────────────── */

const VELOCITY = [1, 0, 2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8];

function AnalyticsPanel() {
  const width = 320;
  const height = 96;
  const max = Math.max(...VELOCITY);
  const points = VELOCITY.map((v, i) => {
    const x = (i / (VELOCITY.length - 1)) * width;
    const y = height - (v / max) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="hp-charts">
      <div className="hp-chart">
        <span className="hp-chart-title">Completion velocity · 14 days</span>
        <svg viewBox={`0 0 ${width} ${height}`} className="hp-spark" data-draw role="img" aria-label="Rising completion velocity over fourteen days">
          <polyline className="hp-spark-line" points={points} fill="none" />
        </svg>
      </div>

      <div className="hp-chart">
        <span className="hp-chart-title">Workload by assignee</span>
        <div className="hp-bars">
          {[
            { who: "JD", pct: 82, lamp: "var(--color-signal)" },
            { who: "MR", pct: 64, lamp: "var(--color-flow)" },
            { who: "AK", pct: 47, lamp: "var(--color-steel)" },
            { who: "SC", pct: 28, lamp: "var(--color-violet)" },
          ].map((bar) => (
            <div className="hp-bar-row" key={bar.who}>
              <span className="hp-bar-who">{bar.who}</span>
              <span className="hp-bar-track">
                <span
                  className="hp-bar-fill"
                  data-bar={bar.pct}
                  style={{ ["--slip-color" as string]: bar.lamp, ["--bar-pct" as string]: `${bar.pct}%` }}
                />
              </span>
              <span className="hp-bar-val">{bar.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────── */

export default function HomePage() {
  const { isAuth } = useAuth();
  const navigate = useNavigate();

  const rootRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const [motion, setMotion] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Motion is opt-in and only switches on once the page is running, so the
  // content is never left hidden behind an animation that did not start.
  useEffect(() => {
    if (!prefersReducedMotion()) setMotion(true);
  }, []);

  useScrollReveal(rootRef, motion);

  // Scroll drives the progress rail, the condensed nav, and the hero
  // parallax. All three are written straight to the DOM inside one
  // animation frame: routing them through React state re-rendered this
  // entire page on every scroll event.
  useEffect(() => {
    let frame = 0;

    function paint() {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const y = window.scrollY;

      if (railRef.current) {
        const progress = max > 0 ? Math.min(1, y / max) : 0;
        railRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      }
      navRef.current?.classList.toggle("is-condensed", y > 24);

      // The hero demo drifts a touch slower than the page — depth, not spectacle.
      if (motion && demoRef.current && y < window.innerHeight) {
        demoRef.current.style.transform = `translate3d(0, ${(-y * 0.06).toFixed(2)}px, 0)`;
      }
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    }

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [motion]);

  const start = useCallback(() => {
    navigate(isAuth ? "/workspaces" : "/signup");
  }, [isAuth, navigate]);

  const ctaLabel = isAuth ? "Open your workspaces" : "Start a board";

  return (
    <div className={`hp ${motion ? "hp-motion" : ""}`} ref={rootRef}>
      <nav className="hp-nav" ref={navRef}>
        <div className="hp-shell">
          <div className="hp-nav-inner">
            <Wordmark />
            <div className="hp-nav-links">
              <a href="#views">Views</a>
              <a href="#card">Cards</a>
              <a href="#intelligence">Intelligence</a>
              <a href="#teams">Teams</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">Questions</a>
            </div>
            <div className="hp-nav-actions">
              <ThemeToggle />
              {isAuth ? (
                <Link to="/workspaces" className="btn btn-primary btn-sm">Open your workspaces</Link>
              ) : (
                <>
                  <Link to="/login" className="hp-nav-login">Log in</Link>
                  <Link to="/signup" className="btn btn-primary btn-sm">Start a board</Link>
                </>
              )}
            </div>
          </div>
        </div>
        <span className="hp-nav-rail" ref={railRef} aria-hidden="true" />
      </nav>

      <header className="hp-shell">
        <div className="hp-hero">
          <div>
            <span className="eyebrow hp-hero-stagger">Work management, on one line</span>
            <h1 className="hp-hero-title hp-hero-stagger">
              Every task,<br />on the <span className="hp-mark">line</span>.
            </h1>
            <p className="hp-hero-lead hp-hero-stagger">
              Gridly puts a team's work on one board and keeps it moving — read it as a board,
              a table, a calendar, or a timeline, break a card down with AI, and watch velocity
              build in the same place.
            </p>
            <div className="hp-hero-cta hp-hero-stagger">
              <button className="btn btn-primary btn-lg" onClick={start}>{ctaLabel}</button>
              <a href="#views" className="btn btn-secondary btn-lg">See it move</a>
            </div>
            <p className="hp-hero-note hp-hero-stagger">
              Free to start · No card needed
            </p>
          </div>

          <div className="hp-demo-wrap" ref={demoRef}>
            <LiveBoard />
          </div>
        </div>
      </header>

      <main>
        {/* ── figures ─────────────────────────────────────── */}
        <section className="hp-figures">
          <div className="hp-shell">
            <div className="hp-figure-strip" data-reveal-group>
              {FIGURES.map((fig) => (
                <div className="hp-figure" key={fig.label}>
                  <span className="hp-figure-val" data-count={fig.value}>
                    <span>{fig.value}</span>{fig.suffix}
                  </span>
                  <span className="hp-figure-label">{fig.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── views ───────────────────────────────────────── */}
        <section className="hp-section" id="views">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">One board, four readings</span>
                <h2 className="hp-section-title">The same cards, however you need to see them</h2>
              </div>
              <p className="hp-section-lead">
                Nothing is copied between views. Change a due date on a card and the calendar
                and the timeline both move.
              </p>
            </div>

            <div data-reveal>
              <ViewStage />
            </div>
          </div>
        </section>

        {/* ── card anatomy ────────────────────────────────── */}
        <section className="hp-section" id="card">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">Inside a card</span>
                <h2 className="hp-section-title">A card holds the whole job, not just its name</h2>
              </div>
              <p className="hp-section-lead">
                Open one and everything about the work is in reach — the write-up, the steps,
                the files, the blockers, and the conversation.
              </p>
            </div>

            <div className="hp-anatomy">
              <div className="hp-anatomy-card" data-reveal>
                <div className="hp-anatomy-cover" aria-hidden="true" />
                <span className="hp-anatomy-id">GR-120</span>
                <h3 className="hp-anatomy-title">Ship board search filters</h3>
                <div className="hp-anatomy-chips">
                  <span className="label-chip"><span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-stop)" }} />urgent</span>
                  <span className="label-chip">due Fri</span>
                  <span className="label-chip">✓ 3/5</span>
                  <span className="label-chip">blocked</span>
                </div>
                <div className="hp-anatomy-bar"><span /></div>
                <div className="hp-anatomy-meta">
                  <span className="hp-mini-who">JD</span>
                  <span className="hp-mini-who">MR</span>
                  <span className="hp-anatomy-note">2 files · 4 comments</span>
                </div>
              </div>

              <ul className="hp-anatomy-list" data-reveal-group>
                {ANATOMY.map((item) => (
                  <li className="hp-anatomy-item" key={item.tag}>
                    <span className="hp-anatomy-tag">{item.tag}</span>
                    <p className="hp-anatomy-text">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── intelligence: AI + analytics ────────────────── */}
        <section className="hp-section" id="intelligence">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">Intelligence</span>
                <h2 className="hp-section-title">Ask for a plan. Read the result.</h2>
              </div>
              <p className="hp-section-lead">
                Gemini drafts the description and the steps. The dashboard tells you whether
                the work is actually clearing.
              </p>
            </div>

            <div className="hp-split">
              <div className="hp-split-pane" data-reveal>
                <span className="hp-pane-tag">AI on the card</span>
                <h3 className="hp-pane-title">A title in, a checklist out</h3>
                <p className="hp-pane-text">
                  Press <em>Draft with AI</em> and the description writes itself in markdown.
                  Press <em>Auto-generate steps</em> and the card fills with the work it takes.
                  Edit anything it gives you — they are ordinary items after that.
                </p>
                <AiPanel />
              </div>

              <div className="hp-split-pane" data-reveal>
                <span className="hp-pane-tag">Analytics</span>
                <h3 className="hp-pane-title">Velocity, workload, and what is stuck</h3>
                <p className="hp-pane-text">
                  Every board and every workspace carries the same dashboard: status split,
                  priority mix, workload by assignee, and completion over the last fourteen days.
                </p>
                <AnalyticsPanel />
              </div>
            </div>
          </div>
        </section>

        {/* ── how it runs ─────────────────────────────────── */}
        <section className="hp-section" id="run">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">Getting going</span>
                <h2 className="hp-section-title">Four moves from empty to running</h2>
              </div>
              <p className="hp-section-lead">
                This is a sequence, and it is short. Most teams are dragging their first card
                inside a couple of minutes.
              </p>
            </div>

            <ol className="hp-steps" data-reveal-group>
              {STEPS.map((step) => (
                <li className="hp-step" key={step.n}>
                  <span className="hp-step-n">{step.n}</span>
                  <h3 className="hp-step-title">{step.title}</h3>
                  <p className="hp-step-text">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── teams: roles + activity ─────────────────────── */}
        <section className="hp-section" id="teams">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">Teams</span>
                <h2 className="hp-section-title">Invite at the level you mean</h2>
              </div>
              <p className="hp-section-lead">
                Three roles per board, and a running tape of everything anyone did to it.
              </p>
            </div>

            <div className="hp-split">
              <div className="hp-roles" data-reveal-group>
                {ROLES.map((row) => (
                  <div className="hp-role" key={row.role} style={{ ["--lamp-color" as string]: row.lamp }}>
                    <span className="lamp" />
                    <span className="hp-role-name">{row.role}</span>
                    <span className="hp-role-can">{row.can}</span>
                  </div>
                ))}
              </div>

              <div className="hp-tape" data-reveal>
                <div className="hp-tape-head">
                  <span className="hp-pane-tag">Activity</span>
                  <span className="hp-demo-live"><span className="lamp" />Live</span>
                </div>
                <ul className="hp-tape-list">
                  {TAPE.map((row, i) => (
                    <li className="hp-tape-row" key={row.target} style={{ ["--lamp-color" as string]: row.lamp, animationDelay: `${i * 90}ms` }}>
                      <span className="hp-mini-who">{row.who}</span>
                      <span className="hp-tape-text">
                        {row.what} <strong>{row.target}</strong>
                      </span>
                      <span className="hp-tape-when">{row.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── pricing ─────────────────────────────────────── */}
        <section className="hp-section" id="pricing">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">Pricing</span>
                <h2 className="hp-section-title">Pay when the board grows</h2>
              </div>
              <p className="hp-section-lead">
                Start free and stay free until you run out of room. Every plan gets the same
                live board, the same four views, and the same dashboard.
              </p>
            </div>

            <div className="hp-plans" data-reveal-group>
              <div className="hp-plan">
                <div className="hp-plan-head">
                  <span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-steel)" }} />
                  <span className="hp-plan-name">Starter</span>
                </div>
                <div className="hp-plan-price">Free</div>
                <span className="hp-plan-unit">forever</span>
                <ul className="hp-plan-list">
                  <li>1 workspace, 3 boards</li>
                  <li>5 members per board</li>
                  <li>All four views and the dashboard</li>
                  <li>24 hours of activity history</li>
                </ul>
                <button className="btn btn-secondary btn-md" onClick={start}>Start a board</button>
              </div>

              <div className="hp-plan hp-plan-lead">
                <div className="hp-plan-head">
                  <span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-signal)" }} />
                  <span className="hp-plan-name">Team</span>
                  <span className="hp-plan-flag">Most picked</span>
                </div>
                <div className="hp-plan-price">$12</div>
                <span className="hp-plan-unit">per member / month</span>
                <ul className="hp-plan-list">
                  <li>Unlimited workspaces and boards</li>
                  <li>Custom fields and dependencies</li>
                  <li>AI drafting and task breakdown</li>
                  <li>30 days of activity history</li>
                </ul>
                <button className="btn btn-primary btn-md" onClick={start}>Start a 14-day trial</button>
              </div>

              <div className="hp-plan">
                <div className="hp-plan-head">
                  <span className="lamp" style={{ ["--lamp-color" as string]: "var(--color-clear)" }} />
                  <span className="hp-plan-name">Company</span>
                </div>
                <div className="hp-plan-price">$29</div>
                <span className="hp-plan-unit">per member / month</span>
                <ul className="hp-plan-list">
                  <li>Everything in Team</li>
                  <li>SSO and SAML</li>
                  <li>Activity exports and audit trail</li>
                  <li>99.9% uptime commitment</li>
                </ul>
                <a href="mailto:sales@gridly.app" className="btn btn-secondary btn-md">Talk to sales</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── faq ─────────────────────────────────────────── */}
        <section className="hp-section" id="faq">
          <div className="hp-shell">
            <div className="hp-section-head" data-reveal>
              <div>
                <span className="eyebrow">Questions</span>
                <h2 className="hp-section-title">Before you start</h2>
              </div>
            </div>

            <div className="hp-faq">
              {FAQ.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div className={`hp-faq-item ${open ? "is-open" : ""}`} key={item.q}>
                    <h3>
                      <button
                        className="hp-faq-q"
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                        aria-controls={`faq-answer-${i}`}
                        id={`faq-question-${i}`}
                      >
                        {item.q}
                        <span className="hp-faq-sign" aria-hidden="true">{open ? "−" : "+"}</span>
                      </button>
                    </h3>
                    <div
                      className="hp-faq-a"
                      id={`faq-answer-${i}`}
                      role="region"
                      aria-labelledby={`faq-question-${i}`}
                    >
                      <div><p>{item.a}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="hp-close">
          <div className="hp-shell" data-reveal>
            <span className="eyebrow">Ready</span>
            <h2 className="hp-close-title">Put the work on the line.</h2>
            <p className="hp-close-text">
              Make a workspace, drop in a board, and send the link. Everything else is one drag away.
            </p>
            <button className="btn btn-primary btn-lg" onClick={start}>{ctaLabel}</button>
          </div>
        </section>
      </main>

      <footer className="hp-footer">
        <div className="hp-shell">
          <div className="hp-footer-grid">
            <div>
              <Wordmark />
              <p className="hp-footer-text">
                A collaborative work manager that shows your team's work moving, one station at
                a time.
              </p>
            </div>
            <div className="hp-footer-cols">
              <div className="hp-footer-col">
                <h4>Product</h4>
                <a href="#views">Views</a>
                <a href="#card">Cards</a>
                <a href="#intelligence">Intelligence</a>
                <a href="#teams">Teams</a>
              </div>
              <div className="hp-footer-col">
                <h4>Account</h4>
                <Link to="/login">Log in</Link>
                <Link to="/signup">Sign up</Link>
                <a href="#pricing">Pricing</a>
              </div>
              <div className="hp-footer-col">
                <h4>Legal</h4>
                <a href="#faq">Privacy</a>
                <a href="#faq">Terms</a>
                <a href="mailto:sales@gridly.app">Contact</a>
              </div>
            </div>
          </div>
          <div className="hp-footer-bottom">
            &copy; {new Date().getFullYear()} Gridly
          </div>
        </div>
      </footer>
    </div>
  );
}
