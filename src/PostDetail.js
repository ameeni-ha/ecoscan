import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { mediaUrl } from "./utils/apiUrls";
import { formatDateFr, formatRelativeTime } from "./utils/formatDateFr";
import { accountTypeLabel, canForumComment } from "./utils/permissions";
import "./Forum.css";

function CommentItem({
  comment,
  childrenByParent,
  depth,
  canReply,
  replyToId,
  setReplyToId,
  replyDraft,
  setReplyDraft,
  sendReply,
  sending,
  currentUserId,
  editingId,
  setEditingId,
  editContent,
  setEditContent,
  handleSaveEdit,
  editSending,
  handleDelete,
  canManageAll,
}) {
  const children = childrenByParent.get(comment.id) || [];
  const atLabel = accountTypeLabel(comment.author?.accountType);
  const isOwner = currentUserId && comment.author?.id === currentUserId;
  const canManage = canManageAll || isOwner;
  const isEditing = editingId === comment.id;
  const isReplying = replyToId === comment.id;

  return (
    <article className="forum-thread-block" style={{ marginLeft: Math.min(depth * 20, 60) }}>
      {isEditing ? (
        <div>
          <textarea
            className="app-input"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{ minHeight: 90, marginBottom: 10 }}
          />
          <div className="app-row">
            <button className="app-btn app-btn-primary" onClick={handleSaveEdit} disabled={editSending}>
              {editSending ? "Sauvegarde..." : "Sauvegarder"}
            </button>
            <button className="app-btn" onClick={() => setEditingId(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div className="forum-reply-meta">
                <strong>{comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : "Utilisateur"}</strong>
                {atLabel ? <span className="forum-type-pill">{atLabel}</span> : null}
              </div>
              <div className="app-muted">{formatRelativeTime(comment.createdAt)}</div>
            </div>
            {canManage ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="forum-action-btn"
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditContent(comment.content);
                  }}
                >
                  ✏️
                </button>
                <button className="forum-action-btn" style={{ color: "#d32f2f" }} onClick={() => handleDelete(comment.id)}>
                  🗑️
                </button>
              </div>
            ) : null}
          </div>
          <div className="forum-reply-text" style={{ marginTop: 8 }}>{comment.content}</div>
          {canReply ? (
            <div className="app-row" style={{ marginTop: 8 }}>
              <button
                className="app-btn forum-reply-trigger"
                onClick={() => {
                  setReplyToId(comment.id);
                  setReplyDraft("");
                }}
              >
                Répondre
              </button>
            </div>
          ) : null}
        </>
      )}

      {isReplying ? (
        <form className="forum-inline-reply" onSubmit={sendReply}>
          <textarea
            className="app-input"
            style={{ minHeight: 80 }}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Votre réponse..."
            required
          />
          <div className="app-row" style={{ marginTop: 8 }}>
            <button className="app-btn app-btn-primary" type="submit" disabled={sending}>
              {sending ? "Envoi..." : "Envoyer"}
            </button>
            <button className="app-btn" type="button" onClick={() => setReplyToId(null)}>Annuler</button>
          </div>
        </form>
      ) : null}

      {children.length ? (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              childrenByParent={childrenByParent}
              depth={depth + 1}
              canReply={canReply}
              replyToId={replyToId}
              setReplyToId={setReplyToId}
              replyDraft={replyDraft}
              setReplyDraft={setReplyDraft}
              sendReply={sendReply}
              sending={sending}
              currentUserId={currentUserId}
              editingId={editingId}
              setEditingId={setEditingId}
              editContent={editContent}
              setEditContent={setEditContent}
              handleSaveEdit={handleSaveEdit}
              editSending={editSending}
              handleDelete={handleDelete}
              canManageAll={canManageAll}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const canComment = canForumComment(user);
  const canManageForum = user?.role === "admin";
  const currentUserId = user?.id || user?._id;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mainContent, setMainContent] = useState("");
  const [replyToId, setReplyToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editSending, setEditSending] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", content: "", tags: "" });

  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const c of comments) {
      const key = c.parentCommentId || "root";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    map.forEach((list) => list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    return map;
  }, [comments]);

  const rootComments = useMemo(() => childrenByParent.get("root") || [], [childrenByParent]);

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
    try {
      await apiRequest(`/forum/posts/${id}/comments`, { method: "POST", token, body: { content: mainContent } });
      setMainContent("");
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

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setEditSending(true);
    try {
      await apiRequest(`/forum/posts/${id}/comments/${editingId}`, { method: "PUT", token, body: { content: editContent } });
      setEditingId(null);
      setEditContent("");
      await load();
    } catch (e) {
      setError(e?.message || "Impossible de modifier le commentaire");
    } finally {
      setEditSending(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce commentaire ?")) return;
    try {
      await apiRequest(`/forum/posts/${id}/comments/${commentId}`, { method: "DELETE", token });
      await load();
    } catch (e) {
      setError(e?.message || "Impossible de supprimer le commentaire");
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce post et ses commentaires ?")) return;
    try {
      await apiRequest(`/forum/posts/${id}`, { method: "DELETE", token });
      navigate("/forum");
    } catch (e) {
      setError(e?.message || "Impossible de supprimer le post");
    }
  };

  const startEditPost = () => {
    if (!post) return;
    setPostForm({
      title: post.title || "",
      content: post.content || "",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
    });
    setIsEditingPost(true);
  };

  const savePostEdit = async (event) => {
    event.preventDefault();
    setEditSending(true);
    setError("");
    try {
      await apiRequest(`/forum/posts/${id}`, {
        method: "PUT",
        token,
        body: postForm,
      });
      setIsEditingPost(false);
      await load();
    } catch (e) {
      setError(e?.message || "Impossible de modifier le post");
    } finally {
      setEditSending(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container forum-detail-layout">
        <div className="app-card forum-detail-card-main">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="badge">💬 Forum</div>
              <h2 style={{ margin: "10px 0 6px", fontSize: 24 }}>{!loading && post ? post.title : "Discussion"}</h2>
              {!loading && post ? (
                <div className="forum-post-meta-line app-muted">
                  {formatDateFr(post.createdAt)} · {post.author?.firstName} {post.author?.lastName}
                </div>
              ) : null}
            </div>
            <div className="app-row" style={{ gap: 8 }}>
              {!loading && post && (canManageForum || post.author?.id === currentUserId) ? (
                <>
                  <button className="app-btn" type="button" onClick={startEditPost}>
                    Modifier
                  </button>
                  <button
                    className="app-btn"
                    type="button"
                    onClick={handleDeletePost}
                    style={{ color: "#d32f2f" }}
                  >
                    Supprimer
                  </button>
                </>
              ) : null}
              <button className="app-btn" type="button" onClick={() => navigate("/forum")}>← Liste</button>
            </div>
          </div>
          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
          {!loading && post?.images?.length ? (
            <div className="forum-detail-gallery" style={{ marginTop: 14 }}>
              {post.images.map((img) => (
                <a key={img.filename || img.url} href={mediaUrl(img.url)} target="_blank" rel="noreferrer">
                  <img src={mediaUrl(img.url)} alt={img.originalName || "Pièce jointe"} />
                </a>
              ))}
            </div>
          ) : null}
          {!loading && post && isEditingPost ? (
            <form className="app-card post-body-card" style={{ marginTop: 14 }} onSubmit={savePostEdit}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Modifier le post</h3>
              <label style={{ fontWeight: 700, fontSize: 13 }}>Titre</label>
              <input
                className="app-input"
                value={postForm.title}
                onChange={(e) => setPostForm((current) => ({ ...current, title: e.target.value }))}
                required
              />
              <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginTop: 10 }}>Contenu</label>
              <textarea
                className="app-input forum-textarea"
                value={postForm.content}
                onChange={(e) => setPostForm((current) => ({ ...current, content: e.target.value }))}
                required
              />
              <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginTop: 10 }}>Tags</label>
              <input
                className="app-input"
                value={postForm.tags}
                onChange={(e) => setPostForm((current) => ({ ...current, tags: e.target.value }))}
                placeholder="plastique, collecte..."
              />
              <div className="app-row" style={{ marginTop: 10 }}>
                <button className="app-btn app-btn-primary" type="submit" disabled={editSending}>
                  {editSending ? "Sauvegarde..." : "Sauvegarder"}
                </button>
                <button className="app-btn" type="button" onClick={() => setIsEditingPost(false)}>
                  Annuler
                </button>
              </div>
            </form>
          ) : !loading && post ? (
            <div className="app-card post-body-card" style={{ marginTop: 14 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Énoncé complet</h3>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>{post.content}</p>
            </div>
          ) : null}
        </div>

        <div className="app-card forum-thread-card">
          <h3 style={{ marginTop: 0 }}>Fil de conversation</h3>
          {!loading && rootComments.length === 0 ? <p className="app-muted">Soyez le premier à intervenir.</p> : null}
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {rootComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                childrenByParent={childrenByParent}
                depth={0}
                canReply={canComment}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                replyDraft={replyDraft}
                setReplyDraft={setReplyDraft}
                sendReply={sendReply}
                sending={sending}
                currentUserId={currentUserId}
                editingId={editingId}
                setEditingId={setEditingId}
                editContent={editContent}
                setEditContent={setEditContent}
                handleSaveEdit={handleSaveEdit}
                editSending={editSending}
                handleDelete={handleDelete}
                canManageAll={canManageForum}
              />
            ))}
          </div>

          {canComment ? (
            <form onSubmit={sendMainComment} style={{ marginTop: 14 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: "block", marginBottom: 8 }}>
                ➕ Ajouter un commentaire principal
              </label>
              <textarea
                className="app-input forum-textarea"
                style={{ minHeight: 100, marginTop: 6 }}
                value={mainContent}
                onChange={(e) => setMainContent(e.target.value)}
                placeholder="Ajoute une info vérifiée..."
                required
              />
              <div className="app-row" style={{ marginTop: 10 }}>
                <button className="app-btn app-btn-primary" type="submit" disabled={sending}>
                  {sending ? "Envoi..." : "Envoyer"}
                </button>
                <button className="app-btn" type="button" onClick={load}>Rafraîchir</button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
