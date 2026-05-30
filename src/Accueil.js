import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const Accueil = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const primaryPath = isAuthenticated ? "/scan" : "/connexion";
  const accountPath = isAuthenticated ? "/dashboard" : "/inscription";

  const highlights = [
    {
      icon: "🤖",
      title: "Reconnaissance par IA",
      text: "Analysez vos déchets en quelques secondes et recevez une consigne de tri claire.",
    },
    {
      icon: "📍",
      title: "Centres proches",
      text: "Trouvez rapidement les points de collecte adaptés au plastique, verre, papier et métal.",
    },
    {
      icon: "🏆",
      title: "Points et classement",
      text: "Transformez chaque geste en points et suivez votre progression écologique.",
    },
    {
      icon: "💬",
      title: "Communauté engagée",
      text: "Partagez vos questions, astuces et initiatives locales avec les autres utilisateurs.",
    },
  ];

  const materials = [
    { name: "Plastique", detail: "Bouteilles, flacons et emballages propres" },
    { name: "Papier", detail: "Journaux, cartons et feuilles non souillées" },
    { name: "Verre", detail: "Bouteilles et bocaux sans bouchon" },
    { name: "Métal", detail: "Canettes, boîtes et petits contenants" },
  ];

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
                onClick={() => navigate(primaryPath)}
              >
                {isAuthenticated ? "Scanner un objet" : "Commencer le scan"}
              </button>
              <button
                className="home-secondary-btn"
                onClick={() => navigate(accountPath)}
              >
                {isAuthenticated ? "Ouvrir mon espace →" : "Créer un compte →"}
              </button>
            </div>
            <div className="home-hero-trust">
              <span>Tri guidé</span>
              <span>Carte interactive</span>
              <span>Impact mesurable</span>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-phone-card">
              <div className="home-phone-top">
                <span className="home-camera-dot" />
                <span>EcoScan IA</span>
              </div>
              <div className="home-scan-preview">
                <span className="home-scan-icon">♻️</span>
                <span className="home-scan-ring" />
              </div>
              <div className="home-result-card">
                <span className="home-result-label">Résultat</span>
                <strong>Bouteille PET recyclable</strong>
                <p>Déposez-la dans le bac plastique le plus proche.</p>
              </div>
            </div>
            <div className="home-floating-card home-floating-card-top">
              +25 pts
            </div>
            <div className="home-floating-card home-floating-card-bottom">
              Centre à 850 m
            </div>
          </div>
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

      <section className="home-features">
        <div className="home-section-heading">
          <span className="home-section-kicker">Pourquoi EcoScan ?</span>
          <h2>Une expérience complète pour mieux recycler</h2>
          <p>
            De l'identification de l'objet au suivi de votre impact, EcoScan
            vous accompagne dans toutes les étapes du tri.
          </p>
        </div>

        <div className="home-feature-grid">
          {highlights.map((item) => (
            <article className="home-feature-card" key={item.title}>
              <div className="home-feature-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
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

      <section className="home-impact">
        <div className="home-impact-card">
          <div className="home-impact-content">
            <span className="home-section-kicker">Impact personnel</span>
            <h2>Visualisez les progrès de chaque geste</h2>
            <p>
              Votre tableau de bord regroupe vos scans, points gagnés, déchets
              évités et recommandations pour améliorer vos habitudes.
            </p>
            <button
              className="home-primary-btn"
              onClick={() => navigate(accountPath)}
            >
              {isAuthenticated ? "Voir mon tableau de bord" : "Créer mon suivi"}
            </button>
          </div>
          <div className="home-impact-panel">
            <div className="home-impact-row">
              <span>Scans ce mois</span>
              <strong>36</strong>
            </div>
            <div className="home-impact-progress">
              <span style={{ width: "72%" }} />
            </div>
            <div className="home-impact-metrics">
              <div>
                <strong>12 kg</strong>
                <span>déchets triés</span>
              </div>
              <div>
                <strong>8.4 kg</strong>
                <span>CO2 évité</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-materials">
        <div className="home-section-heading">
          <span className="home-section-kicker">Guide rapide</span>
          <h2>Les matériaux les plus courants</h2>
          <p>
            Quelques repères simples avant de scanner votre objet ou de chercher
            un centre de collecte.
          </p>
        </div>

        <div className="home-material-grid">
          {materials.map((material) => (
            <article className="home-material-card" key={material.name}>
              <h3>{material.name}</h3>
              <p>{material.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-community">
        <div>
          <span className="home-section-kicker">Communauté</span>
          <h2>Partagez vos initiatives locales</h2>
          <p>
            Posez vos questions, signalez des points de collecte et découvrez
            les bonnes pratiques des autres membres.
          </p>
        </div>
        <div className="home-community-actions">
          <button
            className="home-primary-btn"
            onClick={() => navigate(isAuthenticated ? "/forum" : "/connexion")}
          >
            Rejoindre le forum
          </button>
          <button
            className="home-outline-dark-btn"
            onClick={() => navigate("/centres")}
          >
            Voir les centres
          </button>
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
            onClick={() => navigate(accountPath)}
          >
            {isAuthenticated ? "Accéder à mon espace" : "Démarrer avec un compte"}
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

