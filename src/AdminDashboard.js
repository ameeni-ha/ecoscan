import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { apiRequest } from "./api/client";
import { formatDateFr } from "./utils/formatDateFr";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [centers, setCenters] = useState([]);
  const [posts, setPosts] = useState([]);
  const [scans, setScans] = useState([]);
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

  // Charger les données selon l'onglet
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        if (activeTab === "centers") {
          const data = await apiRequest("/admin/centers", { token });
          setCenters(data.centers || []);
        } else if (activeTab === "posts") {
          const data = await apiRequest("/admin/posts", { token });
          setPosts(data.posts || []);
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
  }, [activeTab, token]);

  const handleHidePost = async (postId) => {
    if (!window.confirm("Masquer ce post ?")) return;
    try {
      await apiRequest(`/admin/posts/${postId}/status`, {
        method: "PATCH",
        token,
        body: { status: "hidden" },
      });
      const data = await apiRequest("/admin/posts", { token });
      setPosts(data.posts || []);
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
      const data = await apiRequest("/admin/posts", { token });
      setPosts(data.posts || []);
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

        {/* Navigation par onglets */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Aperçu
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
                      <tr key={post.id}>
                        <td className="post-title">{post.title}</td>
                        <td>
                          <div className="author-info">
                            <div className="author-name">{post.author?.name || "-"}</div>
                            <div className="author-email">{post.author?.email}</div>
                          </div>
                        </td>
                        <td className="center-text">{post.commentCount}</td>
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
                          </div>
                        </td>
                      </tr>
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
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id}>
                        <td className="scan-label">{scan.label}</td>
                        <td>
                          <span className="material-badge">{scan.material}</span>
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
