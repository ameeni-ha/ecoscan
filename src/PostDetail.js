import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/forum/posts/${id}`, { token });
      setPost(data.post);
      setComments(data.comments || []);
    } catch (e) {
      setError(e?.message || "Post introuvable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sendComment = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await apiRequest(`/forum/posts/${id}/comments`, {
        method: "POST",
        token,
        body: { content },
      });
      setContent("");
      await load();
    } catch (e2) {
      setError(e2?.message || "Impossible d'envoyer le commentaire");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="badge">💬 Comment Post</div>
              <h2 style={{ margin: "10px 0 6px" }}>Détail du post</h2>
              <div className="app-muted">Forum • {id}</div>
            </div>
            <button className="app-btn" type="button" onClick={() => navigate("/forum")}>
              ← Retour
            </button>
          </div>

          {loading && <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>}
          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          {!loading && post && (
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div className="app-card" style={{ background: "#f5faf7" }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{post.title}</div>
                <div className="app-muted" style={{ marginTop: 6 }}>
                  {post.author ? `${post.author.firstName} ${post.author.lastName}` : "Auteur"}{" "}
                  {post.tags?.length ? `• #${post.tags.join(" #")}` : ""}{" "}
                  {post.status === "hidden" ? "• (caché)" : ""}
                </div>
                <p style={{ marginTop: 10, marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {post.content}
                </p>
              </div>

              <div className="app-card">
                <h3 style={{ marginTop: 0 }}>Commentaires</h3>
                {comments.length === 0 ? (
                  <p className="app-muted">Aucun commentaire.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {comments.map((c) => (
                      <div key={c.id} className="app-card" style={{ background: "#ffffff" }}>
                        <div className="app-muted" style={{ marginBottom: 6 }}>
                          {c.author ? `${c.author.firstName} ${c.author.lastName}` : "Utilisateur"}{" "}
                          {c.status === "hidden" ? "• (caché)" : ""}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={sendComment} style={{ marginTop: 12 }}>
                  <label style={{ fontWeight: 700, fontSize: 13 }}>Ajouter un commentaire</label>
                  <textarea
                    className="app-input"
                    style={{ minHeight: 90, marginTop: 6 }}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Ton message…"
                    required
                  />
                  <div className="app-row" style={{ marginTop: 10 }}>
                    <button className="app-btn app-btn-primary" type="submit" disabled={sending}>
                      {sending ? "Envoi…" : "Envoyer"}
                    </button>
                    <button className="app-btn" type="button" onClick={load}>
                      Rafraîchir
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

