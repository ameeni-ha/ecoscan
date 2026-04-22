import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

export default function ScanResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiRequest(`/scans/${id}`, { token });
        setScan(data.scan);
      } catch (e) {
        setError(e?.message || "Scan introuvable");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="badge">✅ View Scan Result</div>
              <h2 style={{ margin: "10px 0 6px" }}>Résultat du scan</h2>
              <div className="app-muted">ID: {id}</div>
            </div>
            <button className="app-btn" type="button" onClick={() => navigate("/scan")}>
              ← Retour au scan
            </button>
          </div>

          {loading && <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>}
          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          {!loading && scan && (
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div className="app-card" style={{ background: "#f5faf7" }}>
                <div className="app-row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div className="app-muted">Objet</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{scan.label}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="badge">{scan.recyclable ? "♻️ Recyclable" : "⚠️ À vérifier"}</div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      +{scan.points} points
                    </div>
                  </div>
                </div>
                <div className="app-muted" style={{ marginTop: 10 }}>
                  Matériau: <b>{scan.material}</b>
                </div>
              </div>

              <div className="app-card" style={{ background: "#ffffff" }}>
                <h3 style={{ marginTop: 0 }}>Conseils de tri</h3>
                <p style={{ margin: 0 }}>{scan.instructions}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

