import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const ACCOUNT_TYPES = {
  collecteur: "collecteur",
  centre: "centre_de_collecte",
};

const MATERIAL_OPTIONS = [
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Metal" },
  { value: "electronique", label: "Electronique" },
  { value: "organique", label: "Organique" },
];

const Inscription = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, isReady } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES.collecteur);
  const [centerName, setCenterName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [materialsAccepted, setMaterialsAccepted] = useState([]);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [capacityPerDayKg, setCapacityPerDayKg] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCollectionCenter = accountType === ACCOUNT_TYPES.centre;

  const toggleMaterial = (materialValue) => {
    setMaterialsAccepted((current) =>
      current.includes(materialValue)
        ? current.filter((item) => item !== materialValue)
        : [...current, materialValue]
    );
  };

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isReady, navigate]);

  const handleConnection = () => {
    navigate("/connexion");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const [firstName, ...rest] = isCollectionCenter
        ? managerName.trim().split(" ")
        : fullName.trim().split(" ");
      const lastName = rest.join(" ");

      await register({
        firstName: firstName || "",
        lastName: lastName || "",
        email,
        password,
        role: "client",
        accountType,
        phone,
        collectionCenter: isCollectionCenter
          ? {
              centerName,
              managerName,
              materialsAccepted,
              city,
              district,
              openingHours,
              capacityPerDayKg,
            }
          : undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Erreur d'inscription");
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
        <p className="ecoscan-subtitle">Créez votre compte éco-citoyen</p>
      </header>

      <main className="ecoscan-main">
        <section className="ecoscan-card">
          <div className="ecoscan-tabs">
            <button
              type="button"
              className="ecoscan-tab"
              onClick={handleConnection}
            >
              Connexion
            </button>
            <button
              type="button"
              className="ecoscan-tab ecoscan-tab-active"
            >
              Inscription
            </button>
          </div>

          <h2 style={{ marginBottom: 12 }}>Inscription</h2>

          {!isReady && <p className="form-info">Verification de votre session...</p>}

          {error && <p className="form-error">{error}</p>}

          <form className="ecoscan-form" onSubmit={handleSubmit}>
            <div className="ecoscan-field">
              <label>Type de compte</label>
              <div className="ecoscan-choice-grid">
                <button
                  type="button"
                  className={`ecoscan-choice-card ${
                    !isCollectionCenter ? "ecoscan-choice-card-active" : ""
                  }`}
                  onClick={() => setAccountType(ACCOUNT_TYPES.collecteur)}
                >
                  <span className="ecoscan-choice-title">Utilisateur collecteur</span>
                  <span className="ecoscan-choice-text">
                    Pour les particuliers ou agents qui collectent des dechets.
                  </span>
                </button>

                <button
                  type="button"
                  className={`ecoscan-choice-card ${
                    isCollectionCenter ? "ecoscan-choice-card-active" : ""
                  }`}
                  onClick={() => setAccountType(ACCOUNT_TYPES.centre)}
                >
                  <span className="ecoscan-choice-title">Centre de collecte</span>
                  <span className="ecoscan-choice-text">
                    Pour les structures qui recoivent et traitent les depots.
                  </span>
                </button>
              </div>
            </div>

            {!isCollectionCenter && (
              <div className="ecoscan-field">
                <label htmlFor="register-name">Nom complet</label>
                <div className="ecoscan-input-wrapper">
                  <span className="ecoscan-input-icon">👤</span>
                  <input
                    id="register-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isCollectionCenter}
                    placeholder="votre nom et prénom"
                  />
                </div>
              </div>
            )}

            {!isCollectionCenter && (
              <div className="ecoscan-field">
                <label htmlFor="register-phone">Telephone</label>
                <div className="ecoscan-input-wrapper">
                  <span className="ecoscan-input-icon">📞</span>
                  <input
                    id="register-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="votre numero de telephone"
                  />
                </div>
              </div>
            )}

            <div className="ecoscan-field">
              <label htmlFor="register-email">Email</label>
              <div className="ecoscan-input-wrapper">
                <span className="ecoscan-input-icon">@</span>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="votre email"
                />
              </div>
            </div>

            <div className="ecoscan-field">
              <label htmlFor="register-password">Mot de passe</label>
              <div className="ecoscan-input-wrapper">
                <span className="ecoscan-input-icon">🔒</span>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Mot de passe"
                />
              </div>
            </div>

            {isCollectionCenter && (
              <>
                <div className="ecoscan-center-box">
                  <div className="ecoscan-section-header">
                    Informations du centre de collecte
                  </div>
                  <p className="ecoscan-helper-text ecoscan-helper-text-top">
                    Renseignez les informations administratives et operationnelles
                    du centre.
                  </p>

                  <div className="ecoscan-field">
                    <label htmlFor="register-center-name">Nom du centre</label>
                    <div className="ecoscan-input-wrapper">
                      <span className="ecoscan-input-icon">🏢</span>
                      <input
                        id="register-center-name"
                        type="text"
                        value={centerName}
                        onChange={(e) => setCenterName(e.target.value)}
                        required={isCollectionCenter}
                        placeholder="ex: Centre Eco Vert"
                      />
                    </div>
                  </div>

                  <div className="ecoscan-field">
                    <label htmlFor="register-phone">Téléphone du centre</label>
                    <div className="ecoscan-input-wrapper">
                      <span className="ecoscan-input-icon">📞</span>
                      <input
                        id="register-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Numéro de téléphone du centre"
                      />
                    </div>
                  </div>

                  <div className="ecoscan-field">
                    <label htmlFor="register-manager-name">Responsable du centre</label>
                    <div className="ecoscan-input-wrapper">
                      <span className="ecoscan-input-icon">👤</span>
                      <input
                        id="register-manager-name"
                        type="text"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        required={isCollectionCenter}
                        placeholder="nom du responsable"
                      />
                    </div>
                  </div>

                  <div className="ecoscan-field">
                    <label>Materiaux acceptes</label>
                    <div className="ecoscan-material-grid">
                      {MATERIAL_OPTIONS.map((material) => {
                        const isSelected = materialsAccepted.includes(material.value);

                        return (
                          <button
                            key={material.value}
                            type="button"
                            className={`ecoscan-material-chip ${
                              isSelected ? "ecoscan-material-chip-active" : ""
                            }`}
                            onClick={() => toggleMaterial(material.value)}
                          >
                            {material.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="ecoscan-helper-text">
                      Selectionnez au moins un type de dechet pris en charge.
                    </p>
                  </div>

                  <div className="ecoscan-double-grid">
                    <div className="ecoscan-field">
                      <label htmlFor="register-city">Ville</label>
                      <div className="ecoscan-input-wrapper">
                        <span className="ecoscan-input-icon">🏙️</span>
                        <input
                          id="register-city"
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required={isCollectionCenter}
                          placeholder="ville"
                        />
                      </div>
                    </div>

                    <div className="ecoscan-field">
                      <label htmlFor="register-district">Quartier / zone</label>
                      <div className="ecoscan-input-wrapper">
                        <span className="ecoscan-input-icon">📌</span>
                        <input
                          id="register-district"
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="quartier ou zone"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="ecoscan-double-grid">
                    <div className="ecoscan-field">
                      <label htmlFor="register-hours">Horaires d'ouverture</label>
                      <div className="ecoscan-input-wrapper">
                        <span className="ecoscan-input-icon">🕒</span>
                        <input
                          id="register-hours"
                          type="text"
                          value={openingHours}
                          onChange={(e) => setOpeningHours(e.target.value)}
                          placeholder="Lun - Sam, 08:00 - 18:00"
                        />
                      </div>
                    </div>

                    <div className="ecoscan-field">
                      <label htmlFor="register-capacity">
                        Capacite / jour (kg)
                      </label>
                      <div className="ecoscan-input-wrapper">
                        <span className="ecoscan-input-icon">⚖️</span>
                        <input
                          id="register-capacity"
                          type="number"
                          min="0"
                          value={capacityPerDayKg}
                          onChange={(e) => setCapacityPerDayKg(e.target.value)}
                          placeholder="ex: 500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="ecoscan-submit"
              disabled={submitting}
            >
              {submitting ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          <p className="ecoscan-footer-note">
            En continuant, vous acceptez nos conditions d'utilisation et notre
            politique de confidentialité.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Inscription;

