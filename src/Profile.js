import { useMemo, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

export default function Profile() {
  const { user, token, updateUser } = useAuth();

  const initial = useMemo(
    () => ({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      adresse: user?.adresse || "",
    }),
    [user]
  );

  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      const data = await apiRequest("/users/me", {
        method: "PATCH",
        token,
        body: { ...form, ...(password ? { password } : {}) },
      });
      updateUser?.(data.user);
      setPassword("");
      setOk("Profil mis à jour.");
    } catch (e2) {
      setError(e2?.message || "Impossible de mettre à jour le profil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card">
          <div className="badge">🧾 Update profile</div>
          <h2 style={{ margin: "10px 0 6px" }}>Mon profil</h2>
          <div className="app-muted">
            Compte: <b>{user?.email}</b> • rôle: <b>{user?.role}</b> • type: <b>{user?.accountType}</b>
          </div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
          {ok && <p className="form-info" style={{ marginTop: 12 }}>{ok}</p>}

          <form onSubmit={save} style={{ marginTop: 14 }}>
            <div className="app-grid-2">
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Prénom</label>
                <input className="app-input" value={form.firstName} onChange={onChange("firstName")} />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Nom</label>
                <input className="app-input" value={form.lastName} onChange={onChange("lastName")} />
              </div>
            </div>

            <div className="app-grid-2" style={{ marginTop: 12 }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Téléphone</label>
                <input className="app-input" value={form.phone} onChange={onChange("phone")} />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Adresse</label>
                <input className="app-input" value={form.adresse} onChange={onChange("adresse")} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Nouveau mot de passe (optionnel)</label>
              <input
                className="app-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="laisser vide pour ne pas changer"
              />
              <div className="app-muted" style={{ marginTop: 6 }}>
                Si tu changes le mot de passe, les autres sessions seront déconnectées.
              </div>
            </div>

            <div className="app-row" style={{ marginTop: 14 }}>
              <button className="app-btn app-btn-primary" type="submit" disabled={loading}>
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

