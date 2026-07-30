import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth";
import Wordmark from "../components/Wordmark";
import ThemeToggle from "../components/ThemeToggle";

import "./AuthPage.css";

const STEPS = [
  { text: "Create a board and name your columns", color: "var(--color-steel)" },
  { text: "Invite the team as editors or viewers", color: "var(--color-signal)" },
  { text: "Drag the first card and watch it land", color: "var(--color-clear)" },
];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(name, email, password);
      navigate("/workspaces");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth auth-reverse">
      <div className="auth-main">
        <div className="auth-top">
          <Wordmark />
          <ThemeToggle />
        </div>

        <div className="auth-body">
          <form onSubmit={handleSubmit} className="auth-plate">
            <span className="eyebrow">Create account</span>
            <h1 className="auth-title">Start the line</h1>
            <p className="auth-sub">One board, three columns, and a team that sees it move.</p>

            {error && <div className="error-banner" role="alert">{error}</div>}

            <div className="auth-field" style={{ marginTop: error ? "1rem" : 0 }}>
              <label htmlFor="name" className="field-label">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="auth-hint">8 characters or more</p>
            </div>

            <button type="submit" className="btn btn-primary btn-md auth-submit" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </button>

            <p className="auth-alt">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        </div>
      </div>

      <aside className="auth-aside gridfield" aria-hidden="true">
        <div className="auth-aside-inner">
          <span className="eyebrow">Three moves in</span>
          <h2 className="auth-aside-title">You'll be running a board in about a minute.</h2>
          <div className="auth-tape">
            {STEPS.map((step) => (
              <div
                className="auth-tape-row"
                key={step.text}
                style={{ ["--tape-color" as string]: step.color }}
              >
                <span>{step.text}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
