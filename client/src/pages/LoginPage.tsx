import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth";
import Wordmark from "../components/Wordmark";
import ThemeToggle from "../components/ThemeToggle";

import "./AuthPage.css";

const TAPE = [
  { text: "Priya moved “Ship search filters” to Running", time: "just now", color: "var(--color-signal)" },
  { text: "Wes cleared “Rewrite the checkout copy”", time: "2m", color: "var(--color-clear)" },
  { text: "Dana added “Audit viewer permissions”", time: "11m", color: "var(--color-steel)" },
  { text: "Priya invited Wes as an editor", time: "1h", color: "var(--color-violet)" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/workspaces");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-main">
        <div className="auth-top">
          <Wordmark />
          <ThemeToggle />
        </div>

        <div className="auth-body">
          <form onSubmit={handleSubmit} className="auth-plate">
            <span className="eyebrow">Sign in</span>
            <h1 className="auth-title">Back to the board</h1>
            <p className="auth-sub">Your columns are exactly where you left them.</p>

            {error && <div className="error-banner" role="alert">{error}</div>}

            <div className="auth-field" style={{ marginTop: error ? "1rem" : 0 }}>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-md auth-submit" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </button>

            <p className="auth-alt">
              No account yet? <Link to="/signup">Create one</Link>
            </p>
          </form>
        </div>
      </div>

      <aside className="auth-aside gridfield" aria-hidden="true">
        <div className="auth-aside-inner">
          <span className="eyebrow">While you were out</span>
          <h2 className="auth-aside-title">The board kept a record.</h2>
          <div className="auth-tape">
            {TAPE.map((row) => (
              <div
                className="auth-tape-row"
                key={row.text}
                style={{ ["--tape-color" as string]: row.color }}
              >
                <span>{row.text}</span>
                <span className="auth-tape-time">{row.time}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
