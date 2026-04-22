import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import Accueil from "./Accueil";
import Connexion from "./Connexion";
import Inscription from "./Inscription";
import Dashboard from "./Dashboard";
import Scan from "./Scan";
import ScanResult from "./ScanResult";
import Forum from "./Forum";
import PostDetail from "./PostDetail";
import RecyclingCenters from "./RecyclingCenters";
import Leaderboard from "./Leaderboard";
import Profile from "./Profile";
import Meeting from "./Meeting";
import AdminUsers from "./AdminUsers";
import ModerateForum from "./ModerateForum";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return <div className="page-loader">Chargement...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/connexion" replace />;
  }

  return children;
};

const RoleRoute = ({ allow, children }) => {
  const { user, isReady } = useAuth();
  if (!isReady) return <div className="page-loader">Chargement...</div>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <Scan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan/:id"
          element={
            <ProtectedRoute>
              <ScanResult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forum"
          element={
            <ProtectedRoute>
              <Forum />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forum/:id"
          element={
            <ProtectedRoute>
              <PostDetail />
            </ProtectedRoute>
          }
        />
        <Route path="/centres" element={<RecyclingCenters />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route
          path="/profil"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rendez-vous"
          element={
            <ProtectedRoute>
              <Meeting />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/utilisateurs"
          element={
            <RoleRoute allow={["admin"]}>
              <AdminUsers />
            </RoleRoute>
          }
        />
        <Route
          path="/moderation/forum"
          element={
            <RoleRoute allow={["moderator", "admin"]}>
              <ModerateForum />
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
