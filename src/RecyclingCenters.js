import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

const MATERIALS = [
  { value: "", label: "Tous" },
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
];

export default function RecyclingCenters() {
  const { isAuthenticated } = useAuth();

  const [city, setCity] = useState("");
  const [material, setMaterial] = useState("");
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (city.trim()) params.set("city", city.trim());
      if (material) params.set("material", material);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/centers${suffix}`);
      setCenters(data.centers || []);
    } catch (e) {
      setError(e?.message || "Impossible de charger les centres");
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
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="badge">🗺️ View recycling center</div>
          <h2 style={{ margin: "10px 0 6px" }}>Centres de collecte</h2>
          <div className="app-muted">
            {isAuthenticated
              ? "Tu peux ensuite demander un rendez-vous depuis la page Rendez-vous."
              : "Connecte-toi pour demander un rendez-vous."}
          </div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <div className="app-grid-2" style={{ marginTop: 14 }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Ville</label>
              <input
                className="app-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="ex: Dakar"
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Matériau</label>
              <select className="app-input" value={material} onChange={(e) => setMaterial(e.target.value)}>
                {MATERIALS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="app-row" style={{ marginTop: 12 }}>
            <button className="app-btn app-btn-primary" type="button" onClick={load} disabled={loading}>
              {loading ? "Recherche…" : "Rechercher"}
            </button>
          </div>
        </div>

        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Résultats</h3>
            <div className="app-muted">{centers.length} centre(s)</div>
          </div>

          {loading ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>
          ) : centers.length === 0 ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Aucun centre trouvé.</p>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {centers.map((c) => (
                <div key={c.id} className="app-card" style={{ background: "#ffffff" }}>
                  <div className="app-row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900 }}>{c.centerName || "Centre de collecte"}</div>
                    {c.city ? <div className="badge">🏙️ {c.city}</div> : null}
                  </div>
                  <div className="app-muted" style={{ marginTop: 6 }}>
                    {c.district ? `${c.district} • ` : ""}
                    {c.openingHours ? `⏰ ${c.openingHours} • ` : ""}
                    {c.phone ? `📞 ${c.phone}` : ""}
                  </div>
                  {c.materialsAccepted?.length ? (
                    <div className="app-muted" style={{ marginTop: 10 }}>
                      Matériaux: <b>{c.materialsAccepted.join(", ")}</b>
                    </div>
                  ) : null}
                  {c.description ? (
                    <div className="app-muted" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                      {c.description}
                    </div>
                  ) : null}
                  <div className="app-muted" style={{ marginTop: 10 }}>
                    ID centre (pour RDV): <b>{c.id}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

