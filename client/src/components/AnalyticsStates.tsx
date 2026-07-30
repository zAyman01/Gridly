import "./AnalyticsDashboard.css";

/*
 * The loading and failure states live apart from the dashboard itself.
 * The dashboard pulls in recharts — around 124 kB gzipped — and is
 * lazy-loaded, so anything shown *instead of* it has to stay out of
 * that chunk or the split buys nothing.
 */

/** Shown while the aggregation is still running. */
export function AnalyticsSkeleton() {
  return (
    <div className="analytics-dash analytics-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics</span>
      <div className="analytics-header">
        <div className="skeleton" style={{ height: "24px", width: "220px" }} />
      </div>
      <div className="analytics-ribbon">
        {[0, 1, 2].map((i) => (
          <div className="metric-card" key={i}>
            <div className="skeleton" style={{ height: "11px", width: "70%" }} />
            <div className="skeleton" style={{ height: "28px", width: "45%" }} />
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="chart-card" key={i}>
            <div className="skeleton" style={{ height: "14px", width: "40%" }} />
            <div className="skeleton" style={{ height: "230px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shown when the aggregation failed. Always offers the way back. */
export function AnalyticsFault({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="analytics-fault" role="alert">
      <span className="eyebrow">Not loaded</span>
      <p className="analytics-fault-text">
        The analytics for this board did not come back. The board itself is fine —
        this is only the dashboard.
      </p>
      {onRetry && (
        <button className="btn btn-secondary btn-md" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}
