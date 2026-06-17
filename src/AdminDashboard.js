import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { apiRequest } from "./api/client";
import { formatDateFr } from "./utils/formatDateFr";
import "./AdminDashboard.css";

const MATERIAL_OPTIONS = [
  "recyclable",
  "recyclage_specialise",
  "plastique",
  "verre",
  "papier_carton",
  "metal",
  "electronique",
  "organique",
  "autre",
];
const CENTER_MATERIAL_OPTIONS = ["plastic", "paper", "glass", "metal", "electronic", "textile", "organic", "mixed"];
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
  const [meetings, setMeetings] = useState([]);
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    role: "client",
    accountType: "collecteur",
  });
  const [editingCenterId, setEditingCenterId] = useState(null);
  const [centerForm, setCenterForm] = useState({
    centerName: "",
    managerName: "",
    city: "",
    address: "",
    phone: "",
    openingHours: "",
    capacityPerDayKg: "",
    materialsAccepted: "",
    isVerified: false,
  });
  const [editingScanId, setEditingScanId] = useState(null);
  const [scanForm, setScanForm] = useState({
    label: "",
    material: "autre",
    sortingClass: "",
    detectionReason: "",
  });
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [meetingForm, setMeetingForm] = useState({
    status: "pending",
    material: "",
    preferredDate: "",
    message: "",
    rejectionReason: "",
    notes: "",
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
        } else if (activeTab === "meetings") {
          const data = await apiRequest("/admin/meetings", { token });
          setMeetings(data.meetings || []);
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
      phone: item.phone || "",
      address: item.address || "",
      role: item.role || "client",
      accountType: item.accountType || "collecteur",
    });
  };

  const cancelUserEdit = () => {
    setEditingUserId(null);
    setUserForm({
      firstName: "",
      lastName: "",
      phone: "",
      address: "",
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
    if (
      !window.confirm(
        "Supprimer cet utilisateur ? La suppression sera refusée s'il possède déjà des scans. Ses demandes de rendez-vous seront retirées des centres."
      )
    ) {
      return;
    }
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

  const openCenterEditForm = (center) => {
    setEditingCenterId(center.id);
    setCenterForm({
      centerName: center.centerName || center.name || "",
      managerName: center.managerName || center.manager || "",
      city: center.city || "",
      address: center.address || "",
      phone: center.phone || "",
      openingHours: center.openingHours || "",
      capacityPerDayKg: String(center.capacityPerDayKg || ""),
      materialsAccepted: (center.materials || []).join(", "),
      isVerified: Boolean(center.verified),
    });
  };

  const cancelCenterEdit = () => setEditingCenterId(null);

  const handleSaveCenter = async (event) => {
    event.preventDefault();
    if (!editingCenterId) return;
    try {
      await apiRequest(`/admin/centers/${editingCenterId}`, {
        method: "PATCH",
        token,
        body: {
          ...centerForm,
          materialsAccepted: centerForm.materialsAccepted
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });
      const data = await apiRequest("/admin/centers", { token });
      setCenters(data.centers || []);
      cancelCenterEdit();
    } catch (e) {
      setError(e?.message || "Erreur modification centre");
    }
  };

  const openScanEditForm = (scan) => {
    setEditingScanId(scan.id);
    setScanForm({
      label: scan.label || "",
      material: scan.material || "autre",
      sortingClass: scan.sortingClass || "",
      detectionReason: scan.detectionReason || "",
    });
  };

  const cancelScanEdit = () => setEditingScanId(null);

  const handleSaveScan = async (event) => {
    event.preventDefault();
    if (!editingScanId) return;
    try {
      await apiRequest(`/admin/scans/${editingScanId}`, {
        method: "PATCH",
        token,
        body: scanForm,
      });
      const data = await apiRequest("/admin/scans", { token });
      setScans(data.scans || []);
      cancelScanEdit();
    } catch (e) {
      setError(e?.message || "Erreur modification scan");
    }
  };

  const openMeetingEditForm = (meeting) => {
    setEditingMeetingId(meeting.id);
    const preferredDate = meeting.preferredDate ? new Date(meeting.preferredDate) : null;
    if (preferredDate && !Number.isNaN(preferredDate.getTime())) {
      preferredDate.setMinutes(preferredDate.getMinutes() - preferredDate.getTimezoneOffset());
    }
    setMeetingForm({
      status: meeting.status || "pending",
      material: meeting.material || "",
      preferredDate: preferredDate && !Number.isNaN(preferredDate.getTime()) ? preferredDate.toISOString().slice(0, 16) : "",
      message: meeting.message || "",
      rejectionReason: meeting.rejectionReason || "",
      notes: meeting.notes || "",
    });
  };

  const cancelMeetingEdit = () => setEditingMeetingId(null);

  const handleSaveMeeting = async (event) => {
    event.preventDefault();
    if (!editingMeetingId) return;
    try {
      await apiRequest(`/admin/meetings/${editingMeetingId}`, {
        method: "PATCH",
        token,
        body: {
          ...meetingForm,
          preferredDate: meetingForm.preferredDate
            ? new Date(meetingForm.preferredDate).toISOString()
            : null,
        },
      });
      const data = await apiRequest("/admin/meetings", { token });
      setMeetings(data.meetings || []);
      cancelMeetingEdit();
    } catch (e) {
      setError(e?.message || "Erreur modification rendez-vous");
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    const reason = window.prompt(
      "Raison de suppression à envoyer au collecteur",
      "Demande supprimée par l'administration."
    );
    if (reason === null) return;

    try {
      await apiRequest(`/admin/meetings/${meetingId}`, {
        method: "DELETE",
        token,
        body: { reason },
      });
      setMeetings((current) => current.filter((meeting) => meeting.id !== meetingId));
    } catch (e) {
      setError(e?.message || "Erreur suppression rendez-vous");
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
                  <label>Téléphone</label>
                  <input
                    className="app-input"
                    value={userForm.phone}
                    onChange={(event) => handleUserFormChange("phone", event.target.value)}
                  />
                </div>
                <div>
                  <label>Adresse</label>
                  <input
                    className="app-input"
                    value={userForm.address}
                    onChange={(event) => handleUserFormChange("address", event.target.value)}
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

        {editingCenterId && (
          <div className="admin-modal-backdrop" onClick={cancelCenterEdit}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <div className="badge">Modifier centre</div>
                  <h2>{centerForm.centerName}</h2>
                  <p className="app-muted">Tous les champs principaux du centre.</p>
                </div>
                <button className="admin-modal-close" type="button" onClick={cancelCenterEdit}>×</button>
              </div>
              <form className="admin-modal-form" onSubmit={handleSaveCenter}>
                <input className="app-input" value={centerForm.centerName} onChange={(e) => setCenterForm((c) => ({ ...c, centerName: e.target.value }))} placeholder="Nom du centre" />
                <input className="app-input" value={centerForm.managerName} onChange={(e) => setCenterForm((c) => ({ ...c, managerName: e.target.value }))} placeholder="Gestionnaire" />
                <input className="app-input" value={centerForm.city} onChange={(e) => setCenterForm((c) => ({ ...c, city: e.target.value }))} placeholder="Ville" />
                <input className="app-input" value={centerForm.address} onChange={(e) => setCenterForm((c) => ({ ...c, address: e.target.value }))} placeholder="Adresse" />
                <input className="app-input" value={centerForm.phone} onChange={(e) => setCenterForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Téléphone" />
                <input className="app-input" value={centerForm.openingHours} onChange={(e) => setCenterForm((c) => ({ ...c, openingHours: e.target.value }))} placeholder="Horaires" />
                <input className="app-input" type="number" value={centerForm.capacityPerDayKg} onChange={(e) => setCenterForm((c) => ({ ...c, capacityPerDayKg: e.target.value }))} placeholder="Capacité / jour (kg)" />
                <input className="app-input" value={centerForm.materialsAccepted} onChange={(e) => setCenterForm((c) => ({ ...c, materialsAccepted: e.target.value }))} placeholder={`Matériaux: ${CENTER_MATERIAL_OPTIONS.join(", ")}`} />
                <label className="app-muted">
                  <input type="checkbox" checked={centerForm.isVerified} onChange={(e) => setCenterForm((c) => ({ ...c, isVerified: e.target.checked }))} /> Centre vérifié
                </label>
                <div className="admin-modal-actions">
                  <button className="app-btn" type="button" onClick={cancelCenterEdit}>Annuler</button>
                  <button className="app-btn app-btn-primary" type="submit">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingScanId && (
          <div className="admin-modal-backdrop" onClick={cancelScanEdit}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <div className="badge">Modifier scan</div>
                  <h2>{scanForm.label || "Scan"}</h2>
                  <p className="app-muted">Objet détecté, matière, classe et raison.</p>
                </div>
                <button className="admin-modal-close" type="button" onClick={cancelScanEdit}>×</button>
              </div>
              <form className="admin-modal-form" onSubmit={handleSaveScan}>
                <input className="app-input" value={scanForm.label} onChange={(e) => setScanForm((c) => ({ ...c, label: e.target.value }))} placeholder="Objet / label" />
                <select className="app-input" value={scanForm.material} onChange={(e) => setScanForm((c) => ({ ...c, material: e.target.value }))}>
                  {MATERIAL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select className="app-input" value={scanForm.sortingClass} onChange={(e) => setScanForm((c) => ({ ...c, sortingClass: e.target.value }))}>
                  <option value="">Classe non précisée</option>
                  <option value="recyclable">recyclable</option>
                  <option value="non_recyclable">non_recyclable</option>
                  <option value="recyclage_specialise">recyclage_specialise</option>
                </select>
                <textarea className="app-input" value={scanForm.detectionReason} onChange={(e) => setScanForm((c) => ({ ...c, detectionReason: e.target.value }))} placeholder="Raison / note admin" />
                <div className="admin-modal-actions">
                  <button className="app-btn" type="button" onClick={cancelScanEdit}>Annuler</button>
                  <button className="app-btn app-btn-primary" type="submit">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingMeetingId && (
          <div className="admin-modal-backdrop" onClick={cancelMeetingEdit}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <div className="badge">Modifier rendez-vous</div>
                  <h2>Demande de rendez-vous</h2>
                  <p className="app-muted">Statut, matière, date, message et notes.</p>
                </div>
                <button className="admin-modal-close" type="button" onClick={cancelMeetingEdit}>×</button>
              </div>
              <form className="admin-modal-form" onSubmit={handleSaveMeeting}>
                <select className="app-input" value={meetingForm.status} onChange={(e) => setMeetingForm((c) => ({ ...c, status: e.target.value }))}>
                  {["pending", "accepted", "rejected", "cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input className="app-input" value={meetingForm.material} onChange={(e) => setMeetingForm((c) => ({ ...c, material: e.target.value }))} placeholder="Matière" />
                <input className="app-input" type="datetime-local" value={meetingForm.preferredDate} onChange={(e) => setMeetingForm((c) => ({ ...c, preferredDate: e.target.value }))} />
                <textarea className="app-input" value={meetingForm.message} onChange={(e) => setMeetingForm((c) => ({ ...c, message: e.target.value }))} placeholder="Message collecteur" />
                <textarea className="app-input" value={meetingForm.rejectionReason} onChange={(e) => setMeetingForm((c) => ({ ...c, rejectionReason: e.target.value }))} placeholder="Raison du refus" />
                <textarea className="app-input" value={meetingForm.notes} onChange={(e) => setMeetingForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes admin/centre" />
                <div className="admin-modal-actions">
                  <button className="app-btn" type="button" onClick={cancelMeetingEdit}>Annuler</button>
                  <button className="app-btn app-btn-primary" type="submit">Enregistrer</button>
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
          <button
            className={`admin-tab ${activeTab === "meetings" ? "active" : ""}`}
            onClick={() => setActiveTab("meetings")}
          >
            📅 Rendez-vous ({stats?.totalMeetings || 0})
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

            <div className="admin-stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalMeetings || 0}</div>
                <div className="stat-label">Rendez-vous</div>
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
                          <div className="action-buttons">
                            <button
                              className="admin-btn"
                              onClick={() => openCenterEditForm(center)}
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              className="admin-btn danger"
                              onClick={() => handleDeleteCenter(center.id)}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
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
                        <td>
                          <div className="action-buttons">
                            <button className="admin-btn" onClick={() => openScanEditForm(scan)} title="Modifier">
                              ✏️
                            </button>
                            <button
                              className="admin-btn danger"
                              onClick={() => handleDeleteScan(scan.id)}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
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

        {/* Onglet Rendez-vous */}
        {activeTab === "meetings" && (
          <div className="admin-content">
            {loading ? (
              <p className="app-muted">Chargement...</p>
            ) : meetings.length === 0 ? (
              <p className="app-muted">Aucun rendez-vous</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Collecteur</th>
                      <th>Centre</th>
                      <th>Matière</th>
                      <th>Date souhaitée</th>
                      <th>Statut</th>
                      <th>Créé le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((meeting) => (
                      <tr key={meeting.id}>
                        <td>
                          <div className="author-info">
                            <div className="author-name">{meeting.requester?.name || "-"}</div>
                            <div className="author-email">{meeting.requester?.email}</div>
                          </div>
                        </td>
                        <td>
                          <div className="author-info">
                            <div className="author-name">{meeting.center?.name || "-"}</div>
                            <div className="author-email">{meeting.center?.city || meeting.center?.email}</div>
                          </div>
                        </td>
                        <td>{meeting.material || "-"}</td>
                        <td>{meeting.preferredDate ? formatDateFr(meeting.preferredDate) : "-"}</td>
                        <td>
                          <span className={`badge ${meeting.status === "pending" ? "hidden" : "published"}`}>
                            {meeting.status}
                          </span>
                        </td>
                        <td>{formatDateFr(meeting.createdAt)}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="admin-btn" onClick={() => openMeetingEditForm(meeting)} title="Modifier">
                              ✏️
                            </button>
                            <button
                              className="admin-btn danger"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              disabled={meeting.status !== "pending"}
                              title={
                                meeting.status === "pending"
                                  ? "Supprimer et notifier le collecteur"
                                  : "Seules les demandes en cours peuvent être supprimées"
                              }
                            >
                              🗑️
                            </button>
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
      </div>
    </div>
  );
}
