import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const Connexion = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isReady } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isReady, navigate]);

  const handleInscription = () => {
    navigate("/inscription");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ecoscan-page">
      <header className="ecoscan-header">
        <div className="ecoscan-logo-circle">
          <span className="ecoscan-logo-icon">♻️</span>
        </div>
        <h1 className="ecoscan-title">EcoScan</h1>
        <p className="ecoscan-subtitle">Connectez-vous pour continuer</p>
      </header>

      <main className="ecoscan-main">
        <section className="ecoscan-card">
          <h2 style={{ marginBottom: 16 }}>Connexion</h2>

          {!isReady && <p className="form-info">Verification de votre session...</p>}

          {error && <p className="form-error">{error}</p>}

          <form className="ecoscan-form" onSubmit={handleSubmit}>
            <div className="ecoscan-field">
              <label htmlFor="login-email">Email</label>
              <div className="ecoscan-input-wrapper">
                <span className="ecoscan-input-icon">@</span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder=" votre email"
                />
              </div>
            </div>

            <div className="ecoscan-field">
              <label htmlFor="login-password">Mot de passe</label>
              <div className="ecoscan-input-wrapper">
                <span className="ecoscan-input-icon">🔒</span>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mot de passe"
                />
              </div>
            </div>

            <button
              type="submit"
              className="ecoscan-submit"
              disabled={submitting}
            >
              {submitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="ecoscan-footer-note" style={{ marginTop: 12 }}>
            Pas de compte ?{" "}
            <span
              onClick={handleInscription}
              className="lien-inscription"
              style={{ cursor: "pointer", color: "#138047", fontWeight: 600 }}
            >
              S'inscrire
            </span>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Connexion;

