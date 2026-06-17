import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

const TYPE_LABELS = {
  meeting_request: "Demande de rendez-vous",
  meeting_accepted: "Rendez-vous accepté",
  meeting_rejected: "Rendez-vous refusé",
  meeting_cancelled: "Rendez-vous annulé",
  new_center: "Nouveau centre",
  system: "Système",
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

export default function Notifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/notifications?limit=50", { token });
      const loadedNotifications = data.notifications || [];
      const hasUnreadNotifications = loadedNotifications.some((notification) => !notification.isRead);

      if (hasUnreadNotifications) {
        await apiRequest("/notifications/read-all", { method: "PATCH", token });
        window.dispatchEvent(new Event("ecoscan:notifications-updated"));
      }

      setNotifications(
        loadedNotifications.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );
    } catch (err) {
      setError(err?.message || "Impossible de charger les notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllAsRead = async () => {
    setError("");
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH", token });
      window.dispatchEvent(new Event("ecoscan:notifications-updated"));
      await loadNotifications();
    } catch (err) {
      setError(err?.message || "Impossible de marquer les notifications comme lues");
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="badge">🔔 Notifications</div>
          <h2 style={{ margin: "10px 0 6px" }}>Notifications</h2>
          <p className="app-muted">
            Les centres reçoivent les nouvelles demandes de rendez-vous ici. Les collecteurs
            reçoivent la réponse quand un centre accepte ou refuse.
          </p>

          {error ? <p className="form-error" style={{ marginTop: 12 }}>{error}</p> : null}

          <div className="app-row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
            <button className="app-btn app-btn-primary" type="button" onClick={loadNotifications}>
              Rafraîchir
            </button>
            <button className="app-btn" type="button" onClick={markAllAsRead}>
              Marquer toutes comme consultées
            </button>
            <Link className="app-btn" to="/rendez-vous">
              Voir les rendez-vous
            </Link>
          </div>
        </div>

        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Boîte de notifications</h3>
            <span className="badge">{unreadCount} non consultée(s)</span>
          </div>

          {loading ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Chargement...</p>
          ) : notifications.length === 0 ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Aucune notification.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className="app-card"
                  style={{
                    background: notification.isRead ? "#ffffff" : "#f0fff7",
                    borderColor: notification.isRead ? undefined : "#9be7bd",
                  }}
                >
                  <div className="app-row" style={{ justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{notification.title}</div>
                      <div className="app-muted" style={{ marginTop: 4 }}>
                        {TYPE_LABELS[notification.type] || notification.type}
                        {notification.createdAt ? ` · ${formatDate(notification.createdAt)}` : ""}
                      </div>
                    </div>
                    {!notification.isRead ? <span className="badge">Nouveau</span> : null}
                  </div>

                  <p className="app-muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                    {notification.message}
                  </p>

                  {notification.data?.meetingDate ? (
                    <p className="app-muted" style={{ marginTop: 6 }}>
                      Date confirmée : <b>{formatDate(notification.data.meetingDate)}</b>
                    </p>
                  ) : null}

                  <div className="app-row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                    {notification.type === "meeting_request" ? (
                      <Link className="app-btn app-btn-primary" to="/rendez-vous">
                        Ouvrir l'inbox centre
                      </Link>
                    ) : null}
                    {["meeting_accepted", "meeting_rejected"].includes(notification.type) ? (
                      <Link className="app-btn app-btn-primary" to="/rendez-vous">
                        Voir ma demande
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
