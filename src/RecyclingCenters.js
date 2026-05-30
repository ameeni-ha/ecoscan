import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import RecyclingCenterMap from "./components/RecyclingCenterMap";

const MATERIALS = [
  { value: "", label: "Tous" },
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
];

const MATERIAL_LABELS = {
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
  mixed: "Mixte",
};

const formatMaterials = (materials) =>
  Array.isArray(materials) && materials.length > 0
    ? materials.map((m) => MATERIAL_LABELS[m] || m).join(", ")
    : "Non précisé";

export default function RecyclingCenters() {
  const { isAuthenticated } = useAuth();

  const [city, setCity] = useState("");
  const [material, setMaterial] = useState("");
  const [centers, setCenters] = useState([]);
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

      const [localData, osmData] = await Promise.all([
        apiRequest(`/centers?${localParams.toString()}`),
        apiRequest(`/osm-recycling-centers?${osmParams.toString()}`),
      ]);

      const localCenters = (localData.centers || []).map((c) => ({
        ...c,
        source: "EcoScan",
      }));
      const osmCenters = (osmData.centers || []).map((c) => ({
        ...c,
        source: c.source || "OpenStreetMap",
      }));

      const seen = new Set();
      const merged = [];

      for (const center of [...localCenters, ...osmCenters]) {
        const key = String(center.id || center._id || "");
        const lat = Number(center.latitude);
        const lon = Number(center.longitude);
        const coordKey =
          Number.isFinite(lat) && Number.isFinite(lon)
            ? `${lat.toFixed(5)},${lon.toFixed(5)}`
            : `name:${center.centerName || ""}:${center.city || ""}`;

        const dedupeKey = key || coordKey;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        merged.push(center);
      }

      setCenters(merged);
    } catch (e) {
      setError(e?.message || "Impossible de charger les centres");
      setCenters([]);
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
            Tous les points trouvés en Tunisie (base EcoScan + OpenStreetMap) sont affichés sur la
            carte avec un marqueur vert ♻.
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
                    <div className="app-row" style={{ gap: 6 }}>
                      {c.source ? <span className="badge">{c.source}</span> : null}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
