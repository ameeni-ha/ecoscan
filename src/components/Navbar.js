import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../App.css";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, logout, logoutAll } = useAuth();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  const handleLogoutAll = async () => {
    setOpen(false);
    await logoutAll();
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
          {isAuthenticated && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Mon espace
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink
              to="/scan"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Scanner
            </NavLink>
          )}
          {isAuthenticated && (
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
          {isAuthenticated && (
            <NavLink
              to="/rendez-vous"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Rendez-vous
            </NavLink>
          )}
          {isAuthenticated && user?.role === "admin" && (
            <NavLink
              to="/admin/utilisateurs"
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              Admin
            </NavLink>
          )}
          {isAuthenticated && (user?.role === "moderator" || user?.role === "admin") && (
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
              <>
                <button type="button" className="nav-cta nav-logout" onClick={handleLogout}>
                  Deconnexion
                </button>
                <button
                  type="button"
                  className="nav-cta nav-logout-all"
                  onClick={handleLogoutAll}
                >
                  Deconnecter tout
                </button>
              </>
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
