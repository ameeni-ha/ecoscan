import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const Accueil = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="home-page">
      <header className="home-hero">
        <div className="home-hero-spacer" />

        <div className="home-hero-content">
          <div className="home-hero-text">
            <div className="home-pill">
              <span className="home-pill-icon">🍃</span>
              <span>Recyclage intelligent propulsé par l'IA</span>
            </div>
            <h1>
              Scannez. <span className="home-accent">Recyclez.</span> Impactez.
            </h1>
            <p className="home-hero-subtitle">
              EcoScan Recycle utilise l'intelligence artificielle pour vous
              guider vers un recyclage efficace et mesurer votre impact
              environnemental.
            </p>
            <div className="home-hero-actions">
              <button
                className="home-primary-btn"
                onClick={() =>
                  navigate(isAuthenticated ? "/dashboard" : "/connexion")
                }
              >
                {isAuthenticated ? "Ouvrir mon espace" : "Se connecter"}
              </button>
              <button
                className="home-secondary-btn"
                onClick={() =>
                  navigate(isAuthenticated ? "/dashboard" : "/inscription")
                }
              >
                {isAuthenticated ? "Voir mon profil →" : "Creer un compte →"}
              </button>
            </div>
          </div>

          <div className="home-hero-visual" />
        </div>
      </header>

      <section className="home-stats">
        <div className="home-stat">
          <div className="home-stat-number">2.4M</div>
          <div className="home-stat-label">Objets scannés</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-number">850T</div>
          <div className="home-stat-label">Plastique recyclé</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-number">120K</div>
          <div className="home-stat-label">Utilisateurs actifs</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-number">45</div>
          <div className="home-stat-label">Villes couvertes</div>
        </div>
      </section>

      <section className="home-how">
        <h2>Comment ça marche ?</h2>
        <p className="home-how-subtitle">
          Trois étapes simples pour révolutionner votre recyclage quotidien.
        </p>

        <div className="home-steps">
          <article className="home-step-card">
            <span className="home-step-badge">Étape 1</span>
            <h3>Scanner Intelligent</h3>
            <p>
              Identifiez instantanément la recyclabilité de vos objets grâce à
              l'IA.
            </p>
          </article>

          <article className="home-step-card">
            <span className="home-step-badge">Étape 2</span>
            <h3>Carte Interactive</h3>
            <p>
              Localisez les points de collecte et centres de recyclage près de
              chez vous.
            </p>
          </article>

          <article className="home-step-card">
            <span className="home-step-badge">Étape 3</span>
            <h3>Suivi d'Impact</h3>
            <p>
              Mesurez votre contribution à la réduction des déchets plastiques.
            </p>
          </article>
        </div>
      </section>

      <section className="home-cta">
        <div className="home-cta-card">
          <div className="home-cta-icon">🌲</div>
          <h2>Rejoignez le mouvement</h2>
          <p>
            Chaque objet scanné nous rapproche d'un avenir sans pollution
            plastique. Commencez dès maintenant.
          </p>
          <button
            className="home-primary-btn"
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/inscription")}
          >
            {isAuthenticated ? "Acceder a mon espace" : "Demarrer avec un compte"}
          </button>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-logo">EcoScan Recycle</div>
        <p>© 2026 EcoScan Recycle. Ensemble pour un avenir durable.</p>
      </footer>
    </div>
  );
};

export default Accueil;

