import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { apiRequest } from "./api/client";
import { formatDateFr } from "./utils/formatDateFr";
import "./AdminDashboard.css";

const MATERIAL_OPTIONS = [
  "plastique",
  "verre",
  "papier_carton",
  "metal",
  "electronique",
  "organique",
  "autre",
];
const ROLE_OPTIONS = ["client", "moderator", "admin"];
const ACCOUNT_TYPE_OPTIONS = ["collecteur", "centre_de_collecte"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [posts, setPosts] = useState([]);
  const [scans, setScans] = useState([]);
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    firstName: "",
    lastName: "",
    role: "client",
    accountType: "collecteur",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Vérifier que c'est un admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Charger les statistiques
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiRequest("/admin/stats", { token });
        setStats(data.stats);
      } catch (e) {
        console.error("Erreur chargement stats:", e);
      }
    };
    loadStats();
  }, [token]);

  const reloadPosts = useCallback(async () => {
    const data = await apiRequest("/admin/posts", { token });
    setPosts(data.posts || []);
  }, [token]);

  const reloadUsers = useCallback(async () => {
    const data = await apiRequest("/admin/users", { token });
    setUsers(data.users || []);
  }, [token]);

  // Charger les données selon l'onglet
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        if (activeTab === "users") {
          await reloadUsers();
        } else if (activeTab === "centers") {
          const data = await apiRequest("/admin/centers", { token });
          setCenters(data.centers || []);
        } else if (activeTab === "posts") {
          await reloadPosts();
        } else if (activeTab === "scans") {
          const data = await apiRequest("/admin/scans", { token });
          setScans(data.scans || []);
        }
      } catch (e) {
        setError(e?.message || "Erreur chargement");
      } finally {
        setLoading(false);
      }
    };

    if (activeTab !== "overview") {
      loadData();
    }
  }, [activeTab, token, reloadPosts, reloadUsers]);

  const handleUpdateUser = async (userId, updates) => {
    try {
      const data = await apiRequest(`/admin/users/${userId}`, {
        method: "PATCH",
        token,
        body: updates,
      });
      setUsers((current) => current.map((item) => (item.id === userId ? data.user : item)));
      return true;
    } catch (e) {
      setError(e?.message || "Erreur modification utilisateur");
      return false;
    }
  };

  const openUserEditForm = (item) => {
    setError("");
    setEditingUserId(item.id);
    setUserForm({
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      role: item.role || "client",
      accountType: item.accountType || "collecteur",
    });
  };

  const cancelUserEdit = () => {
    setEditingUserId(null);
    setUserForm({
      firstName: "",
      lastName: "",
      role: "client",
      accountType: "collecteur",
    });
  };

  const handleUserFormChange = (field, value) => {
    setUserForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveUser = async (event) => {
    event.preventDefault();
    if (!editingUserId) return;

    const saved = await handleUpdateUser(editingUserId, userForm);
    if (saved) {
      cancelUserEdit();
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Supprimer cet utilisateur et ses contenus ?")) return;
    try {
      await apiRequest(`/admin/users/${userId}`, { method: "DELETE", token });
      setUsers((current) => current.filter((item) => item.id !== userId));
      if (editingUserId === userId) {
        cancelUserEdit();
      }
    } catch (e) {
      setError(e?.message || "Erreur suppression utilisateur");
    }
  };

  const handleHidePost = async (postId) => {
    if (!window.confirm("Masquer ce post ?")) return;
    try {
      await apiRequest(`/admin/posts/${postId}/status`, {
        method: "PATCH",
        token,
        body: { status: "hidden" },
      });
      await reloadPosts();
    } catch (e) {
      setError(e?.message || "Erreur");
    }
  };

  const handlePublishPost = async (postId) => {
    if (!window.confirm("Publier ce post ?")) return;
    try {
      await apiRequest(`/admin/posts/${postId}/status`, {
        method: "PATCH",
        token,
        body: { status: "published" },
      });
      await reloadPosts();
    } catch (e) {
      setError(e?.message || "Erreur");
    }
  };

  const handleDeleteCenter = async (centerId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce centre ?")) return;
    try {
      await apiRequest(`/admin/centers/${centerId}`, {
        method: "DELETE",
        token,
      });
      const data = await apiRequest("/admin/centers", { token });
      setCenters(data.centers || []);
    } catch (e) {
      setError(e?.message || "Erreur suppression");
    }
  };

  const handleUpdateScanMaterial = async (scanId, material) => {
    try {
      await apiRequest(`/admin/scans/${scanId}`, {
        method: "PATCH",
        token,
        body: { material },
      });
      const data = await apiRequest("/admin/scans", { token });
      setScans(data.scans || []);
    } catch (e) {
      setError(e?.message || "Erreur modification scan");
    }
  };

  const handleDeleteScan = async (scanId) => {
    if (!window.confirm("Supprimer ce scan ?")) return;
    try {
      await apiRequest(`/admin/scans/${scanId}`, { method: "DELETE", token });
      setScans((current) => current.filter((scan) => scan.id !== scanId));
    } catch (e) {
      setError(e?.message || "Erreur suppression scan");
    }
  };

  const handleEditPost = async (post) => {
    const title = window.prompt("Nouveau titre du post", post.title);
    if (title === null) return;
    const content = window.prompt("Nouveau contenu du post", post.content || "");
    if (content === null) return;

    try {
      await apiRequest(`/admin/posts/${post.id}`, {
        method: "PATCH",
        token,
        body: { title, content, tags: post.tags || [] },
      });
      await reloadPosts();
    } catch (e) {
      setError(e?.message || "Erreur modification post");
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Supprimer ce post et ses commentaires ?")) return;
    try {
      await apiRequest(`/admin/posts/${postId}`, { method: "DELETE", token });
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch (e) {
      setError(e?.message || "Erreur suppression post");
    }
  };

  const togglePostComments = (postId) => {
    setExpandedPostIds((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleUpdateCommentStatus = async (commentId, status) => {
    try {
      await apiRequest(`/admin/comments/${commentId}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      await reloadPosts();
    } catch (e) {
      setError(e?.message || "Erreur modification commentaire");
    }
  };

  const handleEditComment = async (comment) => {
    const content = window.prompt("Nouveau contenu du commentaire", comment.content || "");
    if (content === null) return;

    try {
      await apiRequest(`/admin/comments/${comment.id}`, {
        method: "PATCH",
        token,
        body: { content },
      });
      await reloadPosts();
    } catch (e) {
      setError(e?.message || "Erreur modification commentaire");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Supprimer ce commentaire et ses réponses ?")) return;
    try {
      await apiRequest(`/admin/comments/${commentId}`, { method: "DELETE", token });
      await reloadPosts();
    } catch (e) {
      setError(e?.message || "Erreur suppression commentaire");
    }
  };

  const editingUser = users.find((item) => item.id === editingUserId);

  return (
    <div className="app-page admin-dashboard-page">
      <div className="app-container">
        <div className="admin-header">
          <div>
            <div className="badge">⚙️ Administration</div>
            <h1 style={{ marginTop: 10 }}>Tableau de bord administrateur</h1>
            <p className="app-muted">Gérez les centres, posts et scans de la plateforme</p>
          </div>
          <button className="app-btn" onClick={() => navigate("/dashboard")}>
            ← Retour
          </button>
        </div>

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

        {editingUser && (
          <div className="admin-modal-backdrop" onClick={cancelUserEdit}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <div className="badge">Modifier utilisateur</div>
                  <h2>
                    {editingUser.firstName} {editingUser.lastName}
                  </h2>
                  <p className="app-muted">{editingUser.email}</p>
                </div>
                <button
                  className="admin-modal-close"
                  type="button"
                  onClick={cancelUserEdit}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              <form className="admin-modal-form" onSubmit={handleSaveUser}>
                <div>
                  <label>Prénom</label>
                  <input
                    className="app-input"
                    value={userForm.firstName}
                    onChange={(event) => handleUserFormChange("firstName", event.target.value)}
                  />
                </div>
                <div>
                  <label>Nom</label>
                  <input
                    className="app-input"
                    value={userForm.lastName}
                    onChange={(event) => handleUserFormChange("lastName", event.target.value)}
                  />
                </div>
                <div>
                  <label>Rôle</label>
                  <select
                    className="app-input"
                    value={userForm.role}
                    onChange={(event) => handleUserFormChange("role", event.target.value)}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Type</label>
                  <select
                    className="app-input"
                    value={userForm.accountType}
                    onChange={(event) => handleUserFormChange("accountType", event.target.value)}
                  >
                    {ACCOUNT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-modal-actions">
                  <button className="app-btn" type="button" onClick={cancelUserEdit}>
                    Annuler
                  </button>
                  <button className="app-btn app-btn-primary" type="submit">
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Navigation par onglets */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Aperçu
          </button>
          <button
            className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            👥 Utilisateurs ({stats?.totalUsers || 0})
          </button>
          <button
            className={`admin-tab ${activeTab === "centers" ? "active" : ""}`}
            onClick={() => setActiveTab("centers")}
          >
            🏢 Centres ({stats?.totalCenters || 0})
          </button>
          <button
            className={`admin-tab ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            💬 Posts ({stats?.totalPosts || 0})
          </button>
          <button
            className={`admin-tab ${activeTab === "scans" ? "active" : ""}`}
            onClick={() => setActiveTab("scans")}
          >
            📸 Scans ({stats?.totalScans || 0})
          </button>
        </div>

        {/* Onglet Aperçu */}
        {activeTab === "overview" && stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalUsers}</div>
                <div className="stat-label">Utilisateurs</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalCenters}</div>
                <div className="stat-label">Centres de recyclage</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-icon">💬</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalPosts}</div>
                <div className="stat-label">Posts forum</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-icon">💭</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalComments}</div>
                <div className="stat-label">Commentaires</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-icon">📸</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalScans}</div>
                <div className="stat-label">Scans effectués</div>
              </div>
            </div>

            <div className="admin-stat-card alert">
              <div className="stat-icon">⚠️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.hiddenPosts}</div>
                <div className="stat-label">Posts masqués</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalPoints}</div>
                <div className="stat-label">Points distribués</div>
              </div>
            </div>
          </div>
        )}

        {/* Onglet Utilisateurs */}
        {activeTab === "users" && (
          <div className="admin-content">
            {loading ? (
              <p className="app-muted">Chargement...</p>
            ) : users.length === 0 ? (
              <p className="app-muted">Aucun utilisateur</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Rôle</th>
                      <th>Type</th>
                      <th>Points</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <Fragment key={item.id}>
                        <tr>
                          <td>
                            <div className="author-info">
                              <div className="author-name">
                                {item.firstName} {item.lastName}
                              </div>
                              <div className="author-email">{item.email}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${item.role === "admin" ? "published" : "hidden"}`}>
                              {item.role}
                            </span>
                          </td>
                          <td>{item.accountType}</td>
                          <td className="center-text">⭐ {item.points || 0}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="admin-btn"
                                onClick={() => openUserEditForm(item)}
                                title="Modifier"
                              >
                                Modifier
                              </button>
                              <button
                                className="admin-btn danger"
                                onClick={() => handleDeleteUser(item.id)}
                                disabled={item.role === "admin"}
                                title={
                                  item.role === "admin"
                                    ? "Un administrateur ne peut pas être supprimé"
                                    : "Supprimer"
                                }
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Onglet Centres */}
        {activeTab === "centers" && (
          <div className="admin-content">
            {loading ? (
              <p className="app-muted">Chargement...</p>
            ) : centers.length === 0 ? (
              <p className="app-muted">Aucun centre de recyclage</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nom du centre</th>
                      <th>Gestionnaire</th>
                      <th>Ville</th>
                      <th>Matériaux</th>
                      <th>Vérifié</th>
                      <th>Note</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centers.map((center) => (
                      <tr key={center.id}>
                        <td className="center-name">{center.name}</td>
                        <td>{center.manager}</td>
                        <td>{center.city}</td>
                        <td>
                          <div className="materials-list">
                            {center.materials.slice(0, 2).map((m) => (
                              <span key={m} className="material-badge">
                                {m}
                              </span>
                            ))}
                            {center.materials.length > 2 && (
                              <span className="material-badge">+{center.materials.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${center.verified ? "verified" : "not-verified"}`}>
                            {center.verified ? "✓ Oui" : "✗ Non"}
                          </span>
                        </td>
                        <td>{center.rating > 0 ? `⭐ ${center.rating}` : "-"}</td>
                        <td>
                          <button
                            className="admin-btn danger"
                            onClick={() => handleDeleteCenter(center.id)}
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Onglet Posts */}
        {activeTab === "posts" && (
          <div className="admin-content">
            {loading ? (
              <p className="app-muted">Chargement...</p>
            ) : posts.length === 0 ? (
              <p className="app-muted">Aucun post</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Auteur</th>
                      <th>Commentaires</th>
                      <th>Statut</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <Fragment key={post.id}>
                        <tr>
                          <td className="post-title">
                            <div>{post.title}</div>
                            <div className="post-preview">{post.content}</div>
                          </td>
                          <td>
                            <div className="author-info">
                              <div className="author-name">{post.author?.name || "-"}</div>
                              <div className="author-email">{post.author?.email}</div>
                            </div>
                          </td>
                          <td className="center-text">
                            <button
                              className="admin-btn compact"
                              onClick={() => togglePostComments(post.id)}
                              title="Afficher les commentaires"
                            >
                              {expandedPostIds.has(post.id) ? "Masquer" : "Voir"} ({post.commentCount})
                            </button>
                          </td>
                          <td>
                            <span className={`badge ${post.status === "published" ? "published" : "hidden"}`}>
                              {post.status === "published" ? "📝 Publié" : "🔒 Masqué"}
                            </span>
                          </td>
                          <td>{formatDateFr(post.createdAt)}</td>
                          <td>
                            <div className="action-buttons">
                              {post.status === "published" ? (
                                <button
                                  className="admin-btn"
                                  onClick={() => handleHidePost(post.id)}
                                  title="Masquer"
                                >
                                  🔒
                                </button>
                              ) : (
                                <button
                                  className="admin-btn"
                                  onClick={() => handlePublishPost(post.id)}
                                  title="Publier"
                                >
                                  📝
                                </button>
                              )}
                              <button
                                className="admin-btn"
                                onClick={() => handleEditPost(post)}
                                title="Modifier"
                              >
                                ✏️
                              </button>
                              <button
                                className="admin-btn danger"
                                onClick={() => handleDeletePost(post.id)}
                                title="Supprimer"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedPostIds.has(post.id) && (
                          <tr className="comments-row">
                            <td colSpan="6">
                              <div className="admin-comments-panel">
                                <div className="comments-panel-title">
                                  Commentaires du post ({post.commentCount})
                                </div>
                                {post.comments.length === 0 ? (
                                  <p className="app-muted">Aucun commentaire pour ce post.</p>
                                ) : (
                                  <div className="admin-comments-list">
                                    {post.comments.map((comment) => (
                                      <div key={comment.id} className="admin-comment-card">
                                        <div className="comment-main">
                                          <div className="comment-meta">
                                            <span className="author-name">
                                              {comment.author?.name || "Utilisateur supprimé"}
                                            </span>
                                            <span className="author-email">{comment.author?.email}</span>
                                            <span className={`badge ${comment.status === "published" ? "published" : "hidden"}`}>
                                              {comment.status === "published" ? "Publié" : "Masqué"}
                                            </span>
                                            <span className="comment-date">{formatDateFr(comment.createdAt)}</span>
                                          </div>
                                          <div className="comment-content">{comment.content}</div>
                                        </div>
                                        <div className="action-buttons">
                                          {comment.status === "published" ? (
                                            <button
                                              className="admin-btn"
                                              onClick={() => handleUpdateCommentStatus(comment.id, "hidden")}
                                              title="Masquer le commentaire"
                                            >
                                              🔒
                                            </button>
                                          ) : (
                                            <button
                                              className="admin-btn"
                                              onClick={() => handleUpdateCommentStatus(comment.id, "published")}
                                              title="Publier le commentaire"
                                            >
                                              📝
                                            </button>
                                          )}
                                          <button
                                            className="admin-btn"
                                            onClick={() => handleEditComment(comment)}
                                            title="Modifier le commentaire"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            className="admin-btn danger"
                                            onClick={() => handleDeleteComment(comment.id)}
                                            title="Supprimer le commentaire"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Onglet Scans */}
        {activeTab === "scans" && (
          <div className="admin-content">
            {loading ? (
              <p className="app-muted">Chargement...</p>
            ) : scans.length === 0 ? (
              <p className="app-muted">Aucun scan</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Objet</th>
                      <th>Matériau</th>
                      <th>Recyclable</th>
                      <th>Points</th>
                      <th>Utilisateur</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id}>
                        <td className="scan-label">{scan.label}</td>
                        <td>
                          <select
                            className="app-input"
                            value={scan.material}
                            onChange={(e) => handleUpdateScanMaterial(scan.id, e.target.value)}
                          >
                            {MATERIAL_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="center-text">
                          <span className={`badge ${scan.recyclable ? "recyclable" : "non-recyclable"}`}>
                            {scan.recyclable ? "✓ Oui" : "✗ Non"}
                          </span>
                        </td>
                        <td className="center-text">⭐ {scan.points}</td>
                        <td>
                          <div className="author-info">
                            <div className="author-name">{scan.user?.name || "-"}</div>
                            <div className="author-email">{scan.user?.email}</div>
                          </div>
                        </td>
                        <td>{formatDateFr(scan.createdAt)}</td>
                        <td>
                          <button
                            className="admin-btn danger"
                            onClick={() => handleDeleteScan(scan.id)}
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
