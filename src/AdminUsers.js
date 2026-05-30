import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

const ROLES = ["client", "moderator", "admin"];
const ACCOUNT_TYPES = ["collecteur", "centre_de_collecte"];

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/users", { token });
      setUsers(data.users || []);
    } catch (e) {
      setError(e?.message || "Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateUser = async (id, updates) => {
    setError("");
    try {
      const data = await apiRequest(`/admin/users/${id}`, {
        method: "PATCH",
        token,
        body: updates,
      });
      setUsers((current) => current.map((u) => (u.id === id ? data.user : u)));
    } catch (e) {
      setError(e?.message || "Impossible de modifier l'utilisateur");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Supprimer cet utilisateur et ses contenus ?")) return;
    setError("");
    try {
      await apiRequest(`/admin/users/${id}`, { method: "DELETE", token });
      setUsers((current) => current.filter((u) => u.id !== id));
    } catch (e) {
      setError(e?.message || "Impossible de supprimer l'utilisateur");
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card">
          <div className="badge">👥 Manage Users</div>
          <h2 style={{ margin: "10px 0 6px" }}>Administration des utilisateurs</h2>
          <div className="app-muted">Modifier les comptes, rôles et types d’utilisateur.</div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <div className="app-row" style={{ marginTop: 12 }}>
            <button className="app-btn app-btn-primary" type="button" onClick={load} disabled={loading}>
              {loading ? "Chargement…" : "Rafraîchir"}
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <p className="app-muted">Chargement…</p>
            ) : users.length === 0 ? (
              <p className="app-muted">Aucun utilisateur.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {users.map((u) => (
                  <div key={u.id} className="app-card" style={{ background: "#ffffff" }}>
                    <div className="app-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>
                        {u.firstName} {u.lastName} — {u.email}
                      </div>
                      <div className="badge">{u.accountType}</div>
                    </div>
                    <div className="app-row" style={{ marginTop: 10 }}>
                      <div className="app-muted">Prénom</div>
                      <input
                        className="app-input"
                        style={{ maxWidth: 180 }}
                        value={u.firstName || ""}
                        onChange={(e) => updateUser(u.id, { firstName: e.target.value })}
                      />
                      <div className="app-muted">Nom</div>
                      <input
                        className="app-input"
                        style={{ maxWidth: 180 }}
                        value={u.lastName || ""}
                        onChange={(e) => updateUser(u.id, { lastName: e.target.value })}
                      />
                    </div>
                    <div className="app-row" style={{ marginTop: 10 }}>
                      <div className="app-muted">Rôle</div>
                      <select
                        className="app-input"
                        style={{ maxWidth: 220 }}
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <div className="app-muted">Type</div>
                      <select
                        className="app-input"
                        style={{ maxWidth: 240 }}
                        value={u.accountType}
                        onChange={(e) => updateUser(u.id, { accountType: e.target.value })}
                      >
                        {ACCOUNT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <button
                        className="app-btn"
                        style={{ color: "#d32f2f" }}
                        type="button"
                        onClick={() => deleteUser(u.id)}
                      >
                        Supprimer
                      </button>
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

