import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import "../App.css";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { canUseScan } from "../utils/permissions";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { isAuthenticated, user, token, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setUnreadNotifications(0);
      return undefined;
    }

    let cancelled = false;
    const loadUnreadCount = async () => {
      try {
        const data = await apiRequest("/notifications/unread/count", { token });
        if (!cancelled) setUnreadNotifications(data.unreadCount || 0);
      } catch {
        if (!cancelled) setUnreadNotifications(0);
      }
    };

    loadUnreadCount();
    window.addEventListener("ecoscan:notifications-updated", loadUnreadCount);
    const intervalId = window.setInterval(loadUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("ecoscan:notifications-updated", loadUnreadCount);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, token]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };



  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <span className="navbar-logo-icon">♻️</span>
          <span className="navbar-logo-text">EcoScan</span>
        </div>

        <button
          className="navbar-toggle"
          aria-label="Toggle navigation"
          onClick={() => setOpen((s) => !s)}
        >
          <span className="hamburger" />
        </button>

        <div className={`nav-links ${open ? "open" : ""}`}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            onClick={() => setOpen(false)}
          >
            Accueil
          </NavLink>
          {isAuthenticated && !isAdmin && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Mon espace
            </NavLink>
          )}
          {isAuthenticated && canUseScan(user) && (
            <NavLink
              to="/scan"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Scanner
            </NavLink>
          )}
          {isAuthenticated && !isAdmin && (
            <NavLink
              to="/forum"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Forum
            </NavLink>
          )}
          <NavLink
            to="/centres"
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            onClick={() => setOpen(false)}
          >
            Centres
          </NavLink>
          <NavLink
            to="/leaderboard"
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            onClick={() => setOpen(false)}
          >
            Leaderboard
          </NavLink>
          {isAuthenticated && (
            <NavLink
              to="/profil"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Profil
            </NavLink>
          )}
          {isAuthenticated && !isAdmin && (
            <NavLink
              to="/rendez-vous"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Rendez-vous
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink
              to="/notifications"
              className={({ isActive }) => "nav-link notification-nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
              aria-label={`Notifications, ${unreadNotifications} non consultée(s)`}
              title="Notifications"
            >
              <span className="notification-icon" aria-hidden="true">🔔</span>
              {unreadNotifications > 0 ? (
                <span className="notification-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>
              ) : null}
            </NavLink>
          )}
          {isAuthenticated && isAdmin && (
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Admin
            </NavLink>
          )}
          {isAuthenticated && user?.role === "moderator" && (
            <NavLink
              to="/moderation/forum"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Modération
            </NavLink>
          )}
          <div className="nav-right">
            {isAuthenticated ? (
              <button type="button" className="nav-cta nav-logout" onClick={handleLogout}>
                Deconnexion
              </button>
            ) : (
              <>
                <NavLink to="/connexion" className="nav-cta" onClick={() => setOpen(false)}>
                  Connexion
                </NavLink>
                <NavLink
                  to="/inscription"
                  className="nav-cta nav-cta-primary"
                  onClick={() => setOpen(false)}
                >
                  Inscription
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
