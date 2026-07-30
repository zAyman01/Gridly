import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { ThemeProvider } from "./theme";
import ErrorBoundary from "./components/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

// The app screens pull in charts, drag-and-drop, and sockets — none of which
// the landing page needs, so they load on their own routes.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
const BoardViewPage = lazy(() => import("./pages/BoardViewPage"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuth, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper" />
    );
  }
  if (!isAuth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuth, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper" />
    );
  }
  if (isAuth) return <Navigate to="/workspaces" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
        <CommandPalette />
        <div id="main-content">
        <Suspense fallback={<div className="min-h-screen bg-paper" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignupPage />
              </PublicRoute>
            }
          />
          <Route
            path="/workspaces"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/w/:slug"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/boards/:boardId"
            element={
              <ProtectedRoute>
                <BoardViewPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </div>
        </ErrorBoundary>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
