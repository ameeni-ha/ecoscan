import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { canUseScan } from "./utils/permissions";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="home-page dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-card">
          <span className="dashboard-badge">Espace securise</span>
          <h1>Bienvenue {user?.firstName || "sur EcoScan"}.</h1>
          <p>
            Votre compte est actif. Vous pouvez maintenant poursuivre
            l'integration des fonctionnalites de scan, de carte et de suivi.
          </p>

          <div className="dashboard-grid">
            <article className="dashboard-panel">
              <h2>Profil</h2>
              <p>
                {user?.firstName} {user?.lastName}
              </p>
              <p>{user?.email}</p>
              {user?.points != null && (
                <p style={{ marginTop: 8, fontWeight: 700, color: "#138047" }}>
                  {user.points} points EcoScan
                </p>
              )}
              <button
                type="button"
                className="home-primary-btn"
                style={{ marginTop: 12 }}
                onClick={() => navigate("/profil")}
              >
                Mettre à jour mon profil
              </button>
            </article>

            <article className="dashboard-panel">
              <h2>Prochaines etapes</h2>
              <p>Accéder rapidement aux fonctionnalités principales.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                {canUseScan(user) ? (
                  <button type="button" className="home-primary-btn" onClick={() => navigate("/scan")}>
                    Scanner un objet
                  </button>
                ) : (
                  <p className="form-info" style={{ margin: 0, maxWidth: 320 }}>
                    Compte centre de collecte : le scan est réservé aux collecteurs. Utilisez le forum
                    et les fiches centres pour échanger avec la communauté.
                  </p>
                )}
                <button type="button" className="home-secondary-btn" onClick={() => navigate("/forum")}>
                  Forum
                </button>
                <button type="button" className="home-secondary-btn" onClick={() => navigate("/centres")}>
                  Centres
                </button>
                <button type="button" className="home-secondary-btn" onClick={() => navigate("/leaderboard")}>
                  Leaderboard
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
