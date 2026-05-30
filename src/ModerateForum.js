import { useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

export default function ModerateForum() {
  const { token, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/forum/posts", { token });
      setPosts(data.posts || []);
    } catch (e) {
      setError(e?.message || "Impossible de charger les posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = async (postId, status) => {
    setError("");
    try {
      const data = await apiRequest(`/admin/posts/${postId}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      setPosts((current) =>
        current.map((p) => (p.id === postId ? { ...p, status: data.post.status } : p))
      );
    } catch (e) {
      setError(e?.message || "Impossible de modérer le post");
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm("Supprimer définitivement ce post ?")) return;
    setError("");
    try {
      await apiRequest(`/admin/posts/${postId}`, { method: "DELETE", token });
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch (e) {
      setError(e?.message || "Impossible de supprimer le post");
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card">
          <div className="badge">🛡️ Moderate forum</div>
          <h2 style={{ margin: "10px 0 6px" }}>Modération forum</h2>
          <div className="app-muted">
            {user?.role === "admin"
              ? "Cacher, ré-afficher ou supprimer un post."
              : "Cacher / ré-afficher un post."}
          </div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <div className="app-row" style={{ marginTop: 12 }}>
            <button className="app-btn app-btn-primary" type="button" onClick={load} disabled={loading}>
              {loading ? "Chargement…" : "Rafraîchir"}
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            {loading ? (
              <p className="app-muted">Chargement…</p>
            ) : posts.length === 0 ? (
              <p className="app-muted">Aucun post.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {posts.map((p) => (
                  <div key={p.id} className="app-card" style={{ background: "#ffffff" }}>
                    <div className="app-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>{p.title}</div>
                      <div className="badge">{p.status}</div>
                    </div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      Auteur:{" "}
                      {p.author ? `${p.author.firstName} ${p.author.lastName} (${p.author.email})` : "—"}
                    </div>
                    <div className="app-row" style={{ marginTop: 12 }}>
                      <button
                        className="app-btn"
                        type="button"
                        onClick={() => setStatus(p.id, p.status === "published" ? "hidden" : "published")}
                      >
                        {p.status === "published" ? "Cacher" : "Ré-afficher"}
                      </button>
                      {user?.role === "admin" && (
                        <button
                          className="app-btn"
                          style={{ color: "#d32f2f" }}
                          type="button"
                          onClick={() => deletePost(p.id)}
                        >
                          Supprimer
                        </button>
                      )}
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

