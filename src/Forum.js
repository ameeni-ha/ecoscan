import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { formatDateFr } from "./utils/formatDateFr";
import { mediaUrl } from "./utils/apiUrls";
import { accountTypeLabel } from "./utils/permissions";
import "./Forum.css";

export default function Forum() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [photos, setPhotos] = useState([]);
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
      const formData = new FormData();
      formData.set("title", title);
      formData.set("content", content);
      formData.set("tags", tags);
      photos.forEach((file) => formData.append("photos", file));

      await apiRequest("/forum/posts", {
        method: "POST",
        token,
        body: formData,
      });
      setTitle("");
      setContent("");
      setTags("");
      setPhotos([]);
      await loadPosts();
    } catch (e2) {
      setError(e2?.message || "Impossible de publier");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container forum-page">
        <div className="app-card forum-create-card" style={{ marginBottom: 16 }}>
          <div className="badge">📝 Publication</div>
          <h2 style={{ margin: "10px 0 6px" }}>Forum EcoScan</h2>
          <p className="app-muted">
            Décrivez un problème de tri, partagez une astuce locale ou mobilisez autour du recyclage.
          </p>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <form onSubmit={createPost} style={{ marginTop: 14 }}>
            <div className="app-grid-2">
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Titre du sujet</label>
                <input
                  className="app-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="ex : Où déposer ampoules & piles à Tunis ?"
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Tags</label>
                <input
                  className="app-input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="plastique, verre, collecte…"
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Description détaillée</label>
              <textarea
                className="app-input forum-textarea"
                style={{ minHeight: 140 }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                placeholder="Exposez votre contexte, horaires essayés, photos utiles après upload…"
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Photos (jusqu’à 6)</label>
              <input
                className="app-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files || []))}
              />
              {photos.length ? (
                <div className="app-muted" style={{ marginTop: 6 }}>
                  {photos.length} fichier(s)
                </div>
              ) : null}
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

        <div className="app-card forum-feed">
          <div className="app-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Discussions récentes</h3>
              <p className="app-muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                Cliquez sur une carte pour lire tout le message et intervenir dans le fil de commentaires.
              </p>
            </div>
            <span className="badge forum-count-badge">{posts.length}</span>
          </div>

          {loading ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>
          ) : posts.length === 0 ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Aucun message pour le moment.</p>
          ) : (
            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {posts.map((post) => {
                const atLabel = accountTypeLabel(post.author?.accountType);
                const currentUserId = user?.id || user?._id;
                const isOwner = currentUserId && post.author?.id === currentUserId;
                return (
                  <div
                    key={post.id}
                    className="app-card forum-post-row"
                    onClick={() => navigate(`/forum/${post.id}`)}
                    style={{
                      textAlign: "left",
                      border: "1px solid rgba(19,128,71,0.14)",
                      background: "#fbfffd",
                      padding: "14px 16px",
                      borderRadius: 14,
                      cursor: "pointer",
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: post.previewImage ? "minmax(0,104px) 1fr" : "1fr",
                    }}
                  >
                    {post.previewImage ? (
                      <div style={{ borderRadius: 12, overflow: "hidden", height: 88 }}>
                        <img
                          src={mediaUrl(post.previewImage)}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div
                        aria-hidden
                        style={{
                          height: 88,
                          borderRadius: 12,
                          background: "linear-gradient(135deg,#d8eee2,#eaf6ef)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                          color: "#1b8f4f",
                        }}
                      >
                        ♻️
                      </div>
                    )}
                    <div style={{ minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{post.title}</div>
                        <div className="forum-post-meta-line" style={{ marginTop: 6, fontSize: 13 }}>
                          <span className="app-muted">{formatDateFr(post.createdAt)}</span>
                          {post.author ? (
                            <>
                              <span className="app-muted"> · </span>
                              <span>
                                {post.author.firstName} {post.author.lastName}
                                {atLabel ? (
                                  <span className="forum-type-pill">{atLabel}</span>
                                ) : null}
                              </span>
                            </>
                          ) : null}
                          {post.status === "hidden" ? (
                            <span className="app-muted"> · Masqué (modération)</span>
                          ) : null}
                        </div>
                        {post.excerpt ? (
                          <p className="app-muted forum-excerpt" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>
                            {post.excerpt || ""}
                            {typeof post.content === "string" &&
                            post.content.replace(/\s+/g, " ").trim().length > (post.excerpt || "").length
                              ? "…"
                              : ""}
                          </p>
                        ) : (
                          <p className="app-muted" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>
                            Ouvrir pour lire la discussion complète.
                          </p>
                        )}
                        {post.tags?.length ? (
                          <div className="forum-tag-row" style={{ marginTop: 10 }}>
                            {post.tags.map((tag) => (
                              <span key={tag} className="forum-tag">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {isOwner && (
                        <div
                          style={{ display: "flex", gap: 6, flexShrink: 0, marginTop: 2 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="forum-action-btn"
                            title="Éditer"
                            onClick={() => navigate(`/forum/${post.id}`)}
                            style={{ color: "#666" }}
                          >
                            ✏️
                          </button>
                          <button
                            className="forum-action-btn"
                            title="Supprimer"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce post ?")) return;
                              try {
                                await apiRequest(`/forum/posts/${post.id}`, {
                                  method: "DELETE",
                                  token,
                                });
                                await loadPosts();
                              } catch (err) {
                                setError(err?.message || "Impossible de supprimer le post");
                              }
                            }}
                            style={{ color: "#d32f2f" }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
