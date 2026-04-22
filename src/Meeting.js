import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";

export default function Meeting() {
  const { user, token } = useAuth();
  const isCenter = user?.accountType === "centre_de_collecte";

  const [centers, setCenters] = useState([]);
  const [centerUserId, setCenterUserId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [myMeetings, setMyMeetings] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const centerOptions = useMemo(
    () =>
      centers.map((c) => ({
        id: c.id,
        label: `${c.centerName || "Centre"}${c.city ? ` — ${c.city}` : ""}`,
      })),
    [centers]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [centersData, myData] = await Promise.all([
        apiRequest("/centers"),
        apiRequest("/meetings/my", { token }),
      ]);
      setCenters(centersData.centers || []);
      setMyMeetings(myData.meetings || []);

      if (isCenter || user?.role === "admin") {
        const inboxData = await apiRequest("/meetings/inbox", { token });
        setInbox(inboxData.meetings || []);
      } else {
        setInbox([]);
      }
    } catch (e) {
      setError(e?.message || "Impossible de charger les rendez-vous");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setOk("");
    try {
      await apiRequest("/meetings", {
        method: "POST",
        token,
        body: {
          centerUserId,
          preferredDate: preferredDate ? new Date(preferredDate).toISOString() : null,
          message,
        },
      });
      setOk("Demande envoyée.");
      setCenterUserId("");
      setPreferredDate("");
      setMessage("");
      await load();
    } catch (e2) {
      setError(e2?.message || "Impossible d'envoyer la demande");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="badge">📅 Ask for a meeting</div>
          <h2 style={{ margin: "10px 0 6px" }}>Rendez-vous</h2>
          <div className="app-muted">
            {isCenter ? "En tant que centre, tu reçois des demandes." : "Demande un RDV à un centre."}
          </div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
          {ok && <p className="form-info" style={{ marginTop: 12 }}>{ok}</p>}

          {!isCenter && (
            <form onSubmit={submit} style={{ marginTop: 14 }}>
              <div className="app-grid-2">
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13 }}>Centre</label>
                  <select
                    className="app-input"
                    value={centerUserId}
                    onChange={(e) => setCenterUserId(e.target.value)}
                    required
                  >
                    <option value="">Choisir…</option>
                    {centerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13 }}>Date souhaitée (optionnel)</label>
                  <input
                    className="app-input"
                    type="datetime-local"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Message</label>
                <textarea
                  className="app-input"
                  style={{ minHeight: 90 }}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Décris ce que tu souhaites déposer / discuter…"
                />
              </div>
              <div className="app-row" style={{ marginTop: 12 }}>
                <button className="app-btn app-btn-primary" type="submit" disabled={sending}>
                  {sending ? "Envoi…" : "Envoyer la demande"}
                </button>
                <button className="app-btn" type="button" onClick={load} disabled={loading}>
                  Rafraîchir
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="app-grid-2">
          <div className="app-card">
            <h3 style={{ marginTop: 0 }}>Mes demandes</h3>
            {loading ? (
              <p className="app-muted">Chargement…</p>
            ) : myMeetings.length === 0 ? (
              <p className="app-muted">Aucune demande.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {myMeetings.map((m) => (
                  <div key={m.id} className="app-card" style={{ background: "#ffffff" }}>
                    <div className="app-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>Centre: {m.centerUserId}</div>
                      <div className="badge">{m.status}</div>
                    </div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      {m.preferredDate ? `Date: ${new Date(m.preferredDate).toLocaleString()}` : "Date: —"}
                    </div>
                    {m.message ? <div className="app-muted" style={{ marginTop: 6 }}>{m.message}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="app-card">
            <h3 style={{ marginTop: 0 }}>Inbox centre</h3>
            {!isCenter && user?.role !== "admin" ? (
              <p className="app-muted">Réservé aux centres de collecte / admin.</p>
            ) : loading ? (
              <p className="app-muted">Chargement…</p>
            ) : inbox.length === 0 ? (
              <p className="app-muted">Aucune demande reçue.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {inbox.map((m) => (
                  <div key={m.id} className="app-card" style={{ background: "#ffffff" }}>
                    <div className="app-row" style={{ justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>
                        {m.requester ? `${m.requester.firstName} ${m.requester.lastName}` : "Demande"}
                      </div>
                      <div className="badge">{m.status}</div>
                    </div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      {m.preferredDate ? `Souhait: ${new Date(m.preferredDate).toLocaleString()}` : "Souhait: —"}
                    </div>
                    {m.message ? <div className="app-muted" style={{ marginTop: 6 }}>{m.message}</div> : null}
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

