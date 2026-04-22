import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/leaderboard");
      setRows(data.leaderboard || []);
    } catch (e) {
      setError(e?.message || "Impossible de charger le leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card">
          <div className="badge">🏆 View Leaderboard</div>
          <h2 style={{ margin: "10px 0 6px" }}>Leaderboard</h2>
          <div className="app-muted">Classement basé sur les points gagnés via les scans.</div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <div className="app-row" style={{ marginTop: 12 }}>
            <button className="app-btn app-btn-primary" type="button" onClick={load} disabled={loading}>
              {loading ? "Chargement…" : "Rafraîchir"}
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <p className="app-muted">Chargement…</p>
            ) : rows.length === 0 ? (
              <p className="app-muted">Aucune donnée pour le moment. Fais quelques scans.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {rows.map((r) => (
                  <div key={r.rank} className="app-card" style={{ background: "#ffffff" }}>
                    <div className="app-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>
                        #{r.rank} — {r.user?.firstName} {r.user?.lastName}
                      </div>
                      <div className="badge">{r.points} pts</div>
                    </div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      Scans: <b>{r.scans}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

