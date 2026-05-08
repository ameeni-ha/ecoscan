import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { mediaUrl } from "./utils/apiUrls";
import { formatDateFr, formatRelativeTime } from "./utils/formatDateFr";
import {
  accountTypeLabel,
  canForumComment,
} from "./utils/permissions";

function ReplyLine({ reply }) {
  const atLabel = accountTypeLabel(reply.author?.accountType);
  return (
    <div className="forum-reply-line">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          backgroundColor: "#e0e0e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: "bold",
          color: "#666",
          flexShrink: 0,
        }}>
          {reply.author ? reply.author.firstName[0].toUpperCase() : "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div className="forum-reply-meta">
            <strong>
              {reply.author ? `${reply.author.firstName} ${reply.author.lastName}` : "Utilisateur"}
            </strong>
            {atLabel ? <span className="forum-type-pill">{atLabel}</span> : null}
            {reply.author?.points ? (
              <span style={{ fontSize: 12, color: "#666" }}>
                · ⭐ {reply.author.points} pts
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>
            {formatRelativeTime(reply.createdAt)}
            {reply.status === "hidden" ? " · masqué" : ""}
          </div>
          <div className="forum-reply-text" style={{ marginTop: 6 }}>{reply.content}</div>
        </div>
      </div>
    </div>
  );
}

function CommentThreadBlock({
  root,
  replies,
  canReply,
  onReply,
  replyActive,
  replyDraft,
  onDraftChange,
  onCancelReply,
  onSubmitReply,
  sending,
}) {
  const atLabel = accountTypeLabel(root.author?.accountType);
  return (
    <article className="forum-thread-block">
      <div className="forum-thread-original">
        <div className="forum-thread-strip">Commentaire principal</div>
        
        {/* Auteur et contexte */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#4CAF50",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: "bold",
            color: "white",
            flexShrink: 0,
          }}>
            {root.author ? root.author.firstName[0].toUpperCase() : "?"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 15 }}>
                {root.author ? `${root.author.firstName} ${root.author.lastName}` : "Utilisateur"}
              </strong>
              {atLabel && <span className="forum-type-pill">{atLabel}</span>}
              {root.author?.points && (
                <span style={{ fontSize: 13, color: "#666" }}>
                  ⭐ {root.author.points} pts
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
              {formatRelativeTime(root.createdAt)}
              {root.status === "hidden" ? " · masqué" : ""}
            </div>
          </div>
        </div>
        
        {/* Contenu */}
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginBottom: 16 }}>
          {root.content}
        </div>
      </div>

      {/* Réponses */}
      <div className="forum-replies-panel">
        <div className="forum-replies-title">
          {replies.length === 0 ? "Aucune réponse" : `${replies.length} réponse${replies.length > 1 ? "s" : ""}`}
        </div>
        {replies.length === 0 ? (
          <p className="app-muted forum-replies-empty">Pas encore de réponses — aidez avec un retour précis.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {replies.map((r) => <ReplyLine key={r.id} reply={r} />)}
          </div>
        )}
      </div>

      {/* Formulaire de réponse */}
      {replyActive ? (
        <form className="forum-inline-reply" onSubmit={onSubmitReply}>
          <div className="form-info forum-inline-info">
            Vous répondez dans ce fil ci-dessous.
            <button type="button" className="app-btn forum-inline-cancel" onClick={onCancelReply}>
              Annuler
            </button>
          </div>
          <textarea
            className="app-input"
            style={{ minHeight: 80 }}
            value={replyDraft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Réponse…"
            required
          />
          <button className="app-btn app-btn-primary" type="submit" disabled={sending}>
            {sending ? "Envoi…" : "Envoyer dans ce fil"}
          </button>
        </form>
      ) : (
        canReply && (
          <button
            type="button"
            className="app-btn forum-reply-trigger"
            onClick={() => onReply(root.id)}
          >
            Répondre dans ce bloc
          </button>
        )
      )}
    </article>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [mainContent, setMainContent] = useState("");
  const [replyToId, setReplyToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);

  const canComment = canForumComment(user);

  const rootComments = useMemo(
    () => [...comments.filter((c) => !c.parentCommentId)],
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map();
    comments
      .filter((c) => c.parentCommentId)
      .forEach((reply) => {
        const pid = reply.parentCommentId;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid).push(reply);
      });
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    );
    return map;
  }, [comments]);

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

  const sendMainComment = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await apiRequest(`/forum/posts/${id}/comments`, {
        method: "POST",
        token,
        body: { content: mainContent },
      });
      setMainContent("");
      setReplyToId(null);
      setReplyDraft("");
      await load();
    } catch (e2) {
      setError(e2?.message || "Impossible d'envoyer");
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!replyToId) return;
    setSending(true);
    setError("");
    try {
      await apiRequest(`/forum/posts/${id}/comments`, {
        method: "POST",
        token,
        body: { content: replyDraft, parentCommentId: replyToId },
      });
      setReplyDraft("");
      setReplyToId(null);
      await load();
    } catch (e2) {
      setError(e2?.message || "Impossible d'envoyer la réponse");
    } finally {
      setSending(false);
    }
  };

  const postAuthorBadge = accountTypeLabel(post?.author?.accountType);

  return (
    <div className="app-page">
      <div className="app-container forum-detail-layout">
        <div className="app-card forum-detail-card-main">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="badge">💬 Forum</div>
              <h2 style={{ margin: "10px 0 6px", fontSize: 24 }}>
                {!loading && post ? post.title : "Discussion"}
              </h2>
              {!loading && post ? (
                <div className="forum-post-meta-line app-muted">
                  {formatDateFr(post.createdAt)}
                  {post.author ? (
                    <>
                      {" "}· {post.author.firstName} {post.author.lastName}
                      {postAuthorBadge ? <span className="forum-type-pill">{postAuthorBadge}</span> : null}
                    </>
                  ) : null}
                  {post.status === "hidden" ? " · sujet masqué" : ""}
                </div>
              ) : null}
            </div>
            <button className="app-btn" type="button" onClick={() => navigate("/forum")}>
              ← Liste
            </button>
          </div>

          {loading && <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>}
          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          {!loading && post && (
            <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
              {post.images?.length ? (
                <div className="forum-detail-gallery">
                  {post.images.map((img) => (
                    <a
                      key={img.filename || img.url}
                      href={mediaUrl(img.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={mediaUrl(img.url)} alt={img.originalName || "Pièce jointe"} />
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="app-card post-body-card">
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Énoncé complet</h3>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>{post.content}</p>
                {post.tags?.length ? (
                  <div className="forum-tag-row" style={{ marginTop: 16 }}>
                    {post.tags.map((tag) => (
                      <span key={tag} className="forum-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="app-card forum-thread-card">
          <h3 style={{ marginTop: 0 }}>Fil de conversation</h3>
          {!loading && rootComments.length === 0 ? (
            <p className="app-muted">Soyez le premier à intervenir sous ce message.</p>
          ) : null}

          <div style={{ display: "grid", gap: 18, marginTop: 14 }}>
            {rootComments.map((c) => {
              const replyList = repliesByParent.get(c.id) || [];
              return (
                <CommentThreadBlock
                  key={c.id}
                  root={c}
                  replies={replyList}
                  canReply={canComment}
                  onReply={(cid) => {
                    setReplyToId(cid);
                    setReplyDraft("");
                  }}
                  replyActive={Boolean(replyToId === c.id && canComment)}
                  replyDraft={replyDraft}
                  onDraftChange={setReplyDraft}
                  onCancelReply={() => {
                    setReplyToId(null);
                    setReplyDraft("");
                  }}
                  onSubmitReply={sendReply}
                  sending={sending}
                />
              );
            })}
          </div>

          {canComment ? (
            <form onSubmit={sendMainComment} style={{ marginTop: 14 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Ajouter commentaire principal</label>
              <textarea
                className="app-input forum-textarea"
                style={{ minHeight: 100, marginTop: 6 }}
                value={mainContent}
                onChange={(e) => setMainContent(e.target.value)}
                placeholder="Ajoute une info vérifiée, un lien utile ou une mise à jour terrain…"
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
          ) : (
            <p className="form-error" style={{ marginTop: 14 }}>
              Votre compte ne permet pas encore d’intervenir sur le forum avec ce profil (collecteur ou centre
              requis).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
