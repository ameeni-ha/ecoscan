import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

const MATERIAL_OPTIONS = [
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
];

export default function Scan() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [label, setLabel] = useState("");
  const [material, setMaterial] = useState("plastique");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const materialLabel = useMemo(
    () => MATERIAL_OPTIONS.find((m) => m.value === material)?.label || material,
    [material]
  );

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiRequest("/scans/my", { token });
      setHistory(data.scans || []);
    } catch (e) {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/scans", {
        method: "POST",
        token,
        body: { label, material },
      });
      const id = data?.scan?.id;
      if (id) {
        navigate(`/scan/${id}`);
        return;
      }
      await loadHistory();
      setLabel("");
    } catch (e2) {
      setError(e2?.message || "Impossible de scanner cet objet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="badge">📷 Scan object</div>
              <h2 style={{ margin: "10px 0 6px" }}>Scanner un objet</h2>
              <div className="app-muted">
                Prototype: tu saisis un objet + matériau, l’API renvoie un résultat + des
                points.
              </div>
            </div>
            <div className="app-muted">Matériau: <b>{materialLabel}</b></div>
          </div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
            <div className="app-grid-2">
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Objet</label>
                <input
                  className="app-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="ex: bouteille, canette, carton…"
                  required
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Matériau</label>
                <select
                  className="app-input"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  {MATERIAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="app-row" style={{ marginTop: 12 }}>
              <button className="app-btn app-btn-primary" disabled={loading} type="submit">
                {loading ? "Scan..." : "Lancer le scan"}
              </button>
              <button className="app-btn" type="button" onClick={loadHistory} disabled={historyLoading}>
                Rafraîchir l’historique
              </button>
            </div>
          </form>
        </div>

        <div className="app-card">
          <h3 style={{ marginTop: 0 }}>Historique</h3>
          {historyLoading ? (
            <p className="app-muted">Chargement…</p>
          ) : history.length === 0 ? (
            <p className="app-muted">Aucun scan pour le moment.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {history.map((scan) => (
                <button
                  key={scan.id}
                  type="button"
                  className="app-btn"
                  style={{ textAlign: "left" }}
                  onClick={() => navigate(`/scan/${scan.id}`)}
                >
                  <b>{scan.label}</b> — {scan.material} — {scan.recyclable ? "recyclable" : "à vérifier"} —{" "}
                  {scan.points} pts
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

