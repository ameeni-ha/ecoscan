import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

export default function Forum() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPosts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/forum/posts", { token });
      setPosts(data.posts || []);
    } catch (e) {
      setError(e?.message || "Impossible de charger le forum");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPost = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await apiRequest("/forum/posts", {
        method: "POST",
        token,
        body: { title, content, tags },
      });
      setTitle("");
      setContent("");
      setTags("");
      await loadPosts();
    } catch (e2) {
      setError(e2?.message || "Impossible de publier");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="badge">📝 Create forum post</div>
          <h2 style={{ margin: "10px 0 6px" }}>Forum</h2>
          <div className="app-muted">Pose une question, partage une astuce de tri, etc.</div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <form onSubmit={createPost} style={{ marginTop: 14 }}>
            <div className="app-grid-2">
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Titre</label>
                <input
                  className="app-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="ex: Où recycler les piles ?"
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Tags (optionnel)</label>
                <input
                  className="app-input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ex: plastique, verre, astuces"
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Message</label>
              <textarea
                className="app-input"
                style={{ minHeight: 120 }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                placeholder="Décris ton besoin / ta découverte…"
              />
            </div>
            <div className="app-row" style={{ marginTop: 12 }}>
              <button className="app-btn app-btn-primary" type="submit" disabled={creating}>
                {creating ? "Publication…" : "Publier"}
              </button>
              <button className="app-btn" type="button" onClick={loadPosts} disabled={loading}>
                Rafraîchir
              </button>
            </div>
          </form>
        </div>

        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Derniers posts</h3>
            <div className="app-muted">{posts.length} post(s)</div>
          </div>

          {loading ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>
          ) : posts.length === 0 ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Aucun post pour le moment.</p>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="app-btn"
                  style={{ textAlign: "left" }}
                  onClick={() => navigate(`/forum/${post.id}`)}
                >
                  <div style={{ fontWeight: 900 }}>{post.title}</div>
                  <div className="app-muted">
                    {post.tags?.length ? `#${post.tags.join(" #")} — ` : ""}
                    {post.author ? `${post.author.firstName} ${post.author.lastName}` : "Auteur"}{" "}
                    {post.status === "hidden" ? "• (caché)" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

