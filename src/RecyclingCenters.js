import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import RecyclingCenterMap from "./components/RecyclingCenterMap";
import { buildCenterRegistrationUrl, mergeCenterSources } from "./utils/centerLinking";

const MATERIALS = [
  { value: "", label: "Tous" },
  { value: "recyclage_specialise", label: "Recyclage spécialisé" },
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
];

const MATERIAL_LABELS = {
  recyclable: "Recyclable",
  recyclage_specialise: "Recyclage spécialisé",
  plastic: "Plastique",
  plastique: "Plastique",
  paper: "Papier / carton",
  papier_carton: "Papier / carton",
  cardboard: "Carton",
  glass: "Verre",
  verre: "Verre",
  metal: "Métal",
  electronic: "Électronique",
  electronique: "Électronique",
  organic: "Organique",
  textile: "Textile",
  mixed: "Mixte",
};

const formatMaterials = (materials) =>
  Array.isArray(materials) && materials.length > 0
    ? materials.map((m) => MATERIAL_LABELS[m] || m).join(", ")
    : "Non précisé";

const loadCentersSource = async (path, label) => {
  try {
    const data = await apiRequest(path);
    return { label, data, error: null };
  } catch (err) {
    return { label, data: null, error: err?.message || `Source ${label} indisponible` };
  }
};

export default function RecyclingCenters() {
  const { isAuthenticated } = useAuth();

  const [city, setCity] = useState("");
  const [material, setMaterial] = useState("");
  const [centers, setCenters] = useState([]);
  const [angedLists, setAngedLists] = useState([]);
  const [angedNote, setAngedNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (overrides = {}) => {
    setLoading(true);
    setError("");
    const searchCity = overrides.city !== undefined ? overrides.city : city;
    const searchMaterial = overrides.material !== undefined ? overrides.material : material;
    try {
      const localParams = new URLSearchParams();
      localParams.set("limit", "0");
      localParams.set("includeUnverified", "true");
      if (searchCity.trim()) localParams.set("city", searchCity.trim());
      if (searchMaterial) localParams.set("material", searchMaterial);

      const osmParams = new URLSearchParams();
      osmParams.set("limit", "2500");
      if (searchCity.trim()) osmParams.set("city", searchCity.trim());

      const angedParams = new URLSearchParams();
      if (searchCity.trim()) angedParams.set("city", searchCity.trim());
      if (searchMaterial) angedParams.set("material", searchMaterial);

      const [localResult, osmResult, angedResult] = await Promise.all([
        loadCentersSource(`/centers?${localParams.toString()}`, "EcoScan"),
        loadCentersSource(`/osm-recycling-centers?${osmParams.toString()}`, "OpenStreetMap"),
        loadCentersSource(`/anged-recycling-centers?${angedParams.toString()}`, "ANGed"),
      ]);

      const sourceErrorMessage = [localResult, osmResult, angedResult]
        .filter((result) => result.error)
        .map((result) => `${result.label}: ${result.error}`)
        .join(" · ");

      const localCenters = localResult.data?.centers || [];
      const osmCenters = osmResult.data?.centers || [];
      const angedCenters = angedResult.data?.centers || [];

      const mergedCenters = mergeCenterSources(localCenters, angedCenters, osmCenters);

      setAngedLists(angedResult.data?.officialLists || []);
      setAngedNote(angedResult.data?.note || "");

      setCenters(mergedCenters);

      if (mergedCenters.length === 0 && sourceErrorMessage) {
        setError(sourceErrorMessage);
      } else if (sourceErrorMessage) {
        setError(
          `Certaines sources sont indisponibles (${sourceErrorMessage}). Les autres centres restent affichés.`
        );
      }
    } catch (e) {
      setError(e?.message || "Impossible de charger les centres");
      setCenters([]);
      setAngedLists([]);
      setAngedNote("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card recycling-centers-header" style={{ marginBottom: 16 }}>
          <div className="badge">🗺️ Tunisie</div>
          <h2 style={{ margin: "10px 0 6px" }}>Centres de recyclage</h2>
          <p className="app-muted">
            Tous les points trouvés en Tunisie (base EcoScan + ANGed + OpenStreetMap) sont affichés
            sur la carte avec un marqueur vert ♻.
            {isAuthenticated
              ? " Vous pouvez ensuite demander un rendez-vous depuis la page Rendez-vous."
              : ""}
          </p>

          {error && (
            <p className="form-error" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}

          <div className="app-grid-2" style={{ marginTop: 14 }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Filtrer par ville (optionnel)</label>
              <input
                className="app-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                placeholder="ex: Tunis, Sfax, Sousse… (vide = toute la Tunisie)"
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Matériau (centres EcoScan)</label>
              <select
                className="app-input"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                {MATERIALS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="app-row" style={{ marginTop: 12 }}>
            <button
              className="app-btn app-btn-primary"
              type="button"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Chargement…" : "Rechercher"}
            </button>
            <button
              className="app-btn app-btn-secondary"
              type="button"
              onClick={() => {
                setCity("");
                setMaterial("");
                load({ city: "", material: "" });
              }}
              disabled={loading}
            >
              Toute la Tunisie
            </button>
          </div>
        </div>

        <div className="app-card recycling-map-card" style={{ marginBottom: 16, padding: 0 }}>
          <RecyclingCenterMap centers={centers} loading={loading} />
        </div>

        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Liste des centres</h3>
            <div className="app-muted">{centers.length} centre(s)</div>
          </div>
          {angedNote ? (
            <p className="app-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
              Source ANGed : {angedNote}
            </p>
          ) : null}

          {loading ? (
            <p className="app-muted" style={{ marginTop: 12 }}>
              Chargement…
            </p>
          ) : centers.length === 0 ? (
            <p className="app-muted" style={{ marginTop: 12 }}>
              Aucun centre trouvé.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {centers.map((c) => (
                <div key={c.id || c._id} className="app-card" style={{ background: "#ffffff" }}>
                  <div className="app-row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900 }}>{c.centerName || "Centre de collecte"}</div>
                    <div className="app-row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {c.source ? <span className="badge">{c.source}</span> : null}
                      {c.isLinkedExternal && c.linkedExternalLabel ? (
                        <span className="badge">Lié à {c.linkedExternalLabel}</span>
                      ) : null}
                      {c.canReceiveMeetings ? <span className="badge">Compte EcoScan actif</span> : null}
                      {c.city ? <span className="badge">🏙️ {c.city}</span> : null}
                    </div>
                  </div>
                  <div className="app-muted" style={{ marginTop: 6 }}>
                    {[c.address, c.district].filter(Boolean).join(" • ") || "Adresse non précisée"}
                  </div>
                  <div className="app-grid-2" style={{ marginTop: 10 }}>
                    <div className="app-muted">
                      <b>Horaires:</b> {c.openingHours && c.openingHours !== "N/A" ? c.openingHours : "Non précisé"}
                    </div>
                    <div className="app-muted">
                      <b>Téléphone:</b> {c.phone || "Non précisé"}
                    </div>
                    <div className="app-muted">
                      <b>Email:</b> {c.email || "Non précisé"}
                    </div>
                    <div className="app-muted">
                      <b>Type:</b> {c.centerType || "Non précisé"}
                    </div>
                    <div className="app-muted">
                      <b>Capacité:</b> {c.capacityPerDayKg ? `${c.capacityPerDayKg} kg/jour` : "Non précisé"}
                    </div>
                    <div className="app-muted">
                      <b>Note:</b> {c.rating ? `${c.rating}/5${c.totalReviews ? ` (${c.totalReviews} avis)` : ""}` : "Non précisé"}
                    </div>
                  </div>
                  {Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)) ? (
                    <div className="app-muted" style={{ marginTop: 8 }}>
                      📍 {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                    </div>
                  ) : (
                    <div className="app-muted" style={{ marginTop: 8 }}>
                      Position GPS non disponible
                    </div>
                  )}
                  <div className="app-muted" style={{ marginTop: 10 }}>
                    Matériaux: <b>{formatMaterials(c.materialsAccepted)}</b>
                  </div>
                  {c.website ? (
                    <div className="app-muted" style={{ marginTop: 8 }}>
                      Site web:{" "}
                      <a href={c.website} target="_blank" rel="noreferrer">
                        {c.website}
                      </a>
                    </div>
                  ) : null}
                  {c.description ? (
                    <div className="app-muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
                      {c.description}
                    </div>
                  ) : null}
                  <div className="app-row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    {c.canReceiveMeetings ? (
                      <Link className="app-btn app-btn-primary" to={`/rendez-vous?center=${c.id || c._id}`}>
                        Prendre rendez-vous
                      </Link>
                    ) : null}
                    {c.needsEcoScanAccount ? (
                      <Link className="app-btn" to={buildCenterRegistrationUrl(c)}>
                        Créer un compte EcoScan pour ce centre
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && angedLists.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ margin: "0 0 10px" }}>Listes officielles ANGed</h3>
              <p className="app-muted" style={{ marginTop: 0 }}>
                Ces documents ANGed listent les sociétés autorisées par filière. Ils peuvent contenir
                des adresses non géocodées automatiquement, donc certaines sociétés ne peuvent pas
                être marquées précisément sur la carte sans extraction manuelle du PDF.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {angedLists.map((entry) => (
                  <div key={entry.id} className="app-card" style={{ background: "#f8fffb" }}>
                    <div className="app-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>{entry.title}</div>
                      <span className="badge">ANGed</span>
                    </div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      {entry.category} · Matériaux: <b>{formatMaterials(entry.materialsAccepted)}</b>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <a href={entry.pdfUrl} target="_blank" rel="noreferrer">
                        Télécharger / consulter la liste officielle
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
