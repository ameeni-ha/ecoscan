import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { mergeCenterSources } from "./utils/centerLinking";

const MATERIAL_LABELS = {
  recyclable: "Recyclable",
  non_recyclable: "Non recyclable",
  recyclage_specialise: "Recyclage spécialisé",
  plastique: "Plastique",
  verre: "Verre",
  papier_carton: "Papier / carton",
  metal: "Métal",
  electronique: "Électronique",
  organique: "Organique",
  autre: "Autre / non recyclable",
};

const CENTER_TAG_LABELS = {
  plastic: "Plastique",
  glass: "Verre",
  paper: "Papier / carton",
  metal: "Métal",
  electronic: "Électronique",
  organic: "Organique",
  textile: "Textile",
  mixed: "Mixte",
};

const MATERIAL_TO_CENTER_TAGS = {
  recyclable: [],
  recyclage_specialise: ["electronic", "mixed"],
  plastique: ["plastic"],
  verre: ["glass"],
  papier_carton: ["paper"],
  metal: ["metal"],
  electronique: ["electronic"],
  organique: ["organic"],
  autre: [],
};

const formatMaterial = (material) => MATERIAL_LABELS[material] || material || "Non précisé";

const formatCenterMaterials = (materials) =>
  Array.isArray(materials) && materials.length > 0
    ? materials.map((m) => CENTER_TAG_LABELS[m] || m).join(", ")
    : "Mixte / non précisé";

const centerAcceptsMaterial = (center, material) => {
  const tags = MATERIAL_TO_CENTER_TAGS[material] || [];
  const accepted = Array.isArray(center?.materialsAccepted) ? center.materialsAccepted : [];
  if (!tags.length) return true;
  if (!accepted.length || accepted.includes("mixed")) return true;
  return accepted.some((item) => tags.includes(item));
};

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceKm = (from, center) => {
  const lat2 = Number(center?.latitude);
  const lon2 = Number(center?.longitude);

  if (!from || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - from.latitude);
  const dLon = toRadians(lon2 - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2Rad = toRadians(lat2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) return "distance inconnue";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

const getUnavailableScanMaterials = (center, scans) =>
  scans.filter((scan) => !centerAcceptsMaterial(center, scan.material));

const MeetingScansList = ({ scans }) => {
  if (!Array.isArray(scans) || scans.length === 0) return null;

  return (
    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
      {scans.map((scan) => (
        <div key={scan.id} className="app-muted" style={{ fontSize: 12 }}>
          <b>{scan.label}</b> · {formatMaterial(scan.material)}
          {scan.sortingClass ? ` · ${formatMaterial(scan.sortingClass)}` : ""}
        </div>
      ))}
    </div>
  );
};

const loadOptionalSource = async (path) => {
  try {
    const data = await apiRequest(path);
    return data.centers || [];
  } catch {
    return [];
  }
};

export default function Meeting() {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const isCenter = user?.accountType === "centre_de_collecte";

  const [centers, setCenters] = useState([]);
  const [scans, setScans] = useState([]);
  const [selectedScanIds, setSelectedScanIds] = useState([]);
  const [centerUserId, setCenterUserId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const [myMeetings, setMyMeetings] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas disponible dans ce navigateur.");
      return;
    }

    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocationError(
          "Position non autorisée. Les centres restent affichés, mais sans tri précis par distance."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [localCenters, angedCenters, osmCenters, myData] = await Promise.all([
        loadOptionalSource("/centers?limit=0&includeUnverified=true"),
        loadOptionalSource("/anged-recycling-centers"),
        loadOptionalSource("/osm-recycling-centers?limit=2500"),
        apiRequest("/meetings/my", { token }),
      ]);

      const mergedCenters = mergeCenterSources(localCenters, angedCenters, osmCenters);

      setCenters(mergedCenters);
      setMyMeetings(myData.meetings || []);

      if (!isCenter) {
        const scansData = await apiRequest("/scans/my", { token });
        setScans(scansData.scans || []);
      } else {
        setScans([]);
      }

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

  useEffect(() => {
    if (!isCenter) {
      requestUserLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCenter]);

  useEffect(() => {
    const c = searchParams.get("center");
    const msg = searchParams.get("message");
    const scanIds = searchParams.get("scanIds");
    if (c) setCenterUserId(c);
    if (msg !== null && msg !== "") setMessage(msg);
    if (scanIds) {
      setSelectedScanIds(
        scanIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      );
    }
  }, [searchParams]);

  const selectedCenter = useMemo(
    () => centers.find((center) => String(center.id) === String(centerUserId)),
    [centers, centerUserId]
  );

  const minMeetingDate = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  const selectedScans = useMemo(
    () => scans.filter((scan) => selectedScanIds.includes(scan.id)),
    [scans, selectedScanIds]
  );

  const centerOptions = useMemo(
    () =>
      centers
        .map((center) => {
          const distanceKm = getDistanceKm(userLocation, center);
          const unavailableScans = getUnavailableScanMaterials(center, selectedScans);
          const isCompatible = unavailableScans.length === 0;
          const status = !center.canReceiveMeetings
            ? "pas de compte EcoScan"
            : !isCompatible
            ? "matière non acceptée"
            : selectedScans.length > 0
            ? "compatible"
            : "matériaux à vérifier";

          return {
            id: center.id,
            disabled: !center.canReceiveMeetings || !isCompatible,
            distanceKm,
            isCompatible,
            canReceiveMeetings: Boolean(center.canReceiveMeetings),
            label: `${center.centerName || "Centre"}${center.city ? ` — ${center.city}` : ""} — ${status}${
              distanceKm !== null ? ` — ${formatDistance(distanceKm)}` : ""
            }`,
          };
        })
        .sort((a, b) => {
          if (a.canReceiveMeetings !== b.canReceiveMeetings) return a.canReceiveMeetings ? -1 : 1;
          if (a.isCompatible !== b.isCompatible) return a.isCompatible ? -1 : 1;
          if (a.distanceKm === null && b.distanceKm === null) return a.label.localeCompare(b.label);
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        }),
    [centers, selectedScans, userLocation]
  );

  const incompatibleScans = useMemo(
    () =>
      selectedCenter
        ? selectedScans.filter((scan) => !centerAcceptsMaterial(selectedCenter, scan.material))
        : [],
    [selectedCenter, selectedScans]
  );

  const selectedCenterDistanceKm = useMemo(
    () => getDistanceKm(userLocation, selectedCenter),
    [selectedCenter, userLocation]
  );

  const toggleScan = (scanId) => {
    setSelectedScanIds((current) =>
      current.includes(scanId) ? current.filter((id) => id !== scanId) : [...current, scanId]
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setOk("");
    try {
      if (incompatibleScans.length > 0) {
        setError(
          `Ce centre n'accepte pas tous les matériaux sélectionnés : ${incompatibleScans
            .map((scan) => `${scan.label} (${formatMaterial(scan.material)})`)
            .join(", ")}.`
        );
        setSending(false);
        return;
      }

      if (!selectedCenter?.canReceiveMeetings) {
        setError("Ce centre n'a pas de compte EcoScan et ne peut pas recevoir de notification.");
        setSending(false);
        return;
      }

      if (preferredDate && new Date(preferredDate).getTime() < Date.now()) {
        setError("La date du rendez-vous ne peut pas être avant la date actuelle.");
        setSending(false);
        return;
      }

      await apiRequest("/meetings", {
        method: "POST",
        token,
        body: {
          centerUserId,
          preferredDate: preferredDate ? new Date(preferredDate).toISOString() : null,
          message,
          scanIds: selectedScanIds,
        },
      });
      setOk("Demande envoyée.");
      setCenterUserId("");
      setPreferredDate("");
      setMessage("");
      setSelectedScanIds([]);
      await load();
    } catch (e2) {
      setError(e2?.message || "Impossible d'envoyer la demande");
    } finally {
      setSending(false);
    }
  };

  const acceptMeeting = async (meeting) => {
    setError("");
    setOk("");
    try {
      await apiRequest(`/meetings/${meeting.id}/accept`, {
        method: "PATCH",
        token,
        body: {
          meetingDate: meeting.preferredDate || null,
          notes: "Rendez-vous accepté par le centre.",
        },
      });
      setOk("Rendez-vous accepté. Le collecteur a reçu une notification.");
      await load();
    } catch (err) {
      setError(err?.message || "Impossible d'accepter ce rendez-vous.");
    }
  };

  const rejectMeeting = async (meeting) => {
    const rejectionReason = window.prompt("Raison du refus ?", "Matériaux non acceptés ou créneau indisponible");
    if (rejectionReason === null) return;
    setError("");
    setOk("");
    try {
      await apiRequest(`/meetings/${meeting.id}/reject`, {
        method: "PATCH",
        token,
        body: { rejectionReason },
      });
      setOk("Rendez-vous refusé. Le collecteur a reçu une notification.");
      await load();
    } catch (err) {
      setError(err?.message || "Impossible de refuser ce rendez-vous.");
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
                      <option key={c.id} value={c.id} disabled={c.disabled}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="app-muted" style={{ marginTop: 6, fontSize: 12 }}>
                    Les centres sont triés du plus proche au plus loin quand votre position est disponible.
                    {locationError ? ` ${locationError}` : ""}
                    <button
                      type="button"
                      className="app-btn"
                      onClick={requestUserLocation}
                      style={{ marginLeft: 8, padding: "4px 8px", fontSize: 12 }}
                    >
                      Utiliser ma position
                    </button>
                  </div>
                  {selectedCenter ? (
                    <div className="app-muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Matériaux acceptés : <b>{formatCenterMaterials(selectedCenter.materialsAccepted)}</b>
                      {selectedCenter.source ? ` · Source: ${selectedCenter.source}` : ""}
                      {selectedCenterDistanceKm !== null
                        ? ` · Distance: ${formatDistance(selectedCenterDistanceKm)}`
                        : " · Distance inconnue"}
                      {!selectedCenter.canReceiveMeetings ? " · Rendez-vous indisponible sans compte EcoScan" : ""}
                      {incompatibleScans.length > 0
                        ? ` · Matières non acceptées : ${incompatibleScans
                            .map((scan) => formatMaterial(scan.material))
                            .join(", ")}`
                        : selectedScans.length > 0
                        ? " · Matières sélectionnées acceptées"
                        : ""}
                    </div>
                  ) : null}
                </div>
                <div>
                  <label style={{ fontWeight: 700, fontSize: 13 }}>Date souhaitée (optionnel)</label>
                  <input
                    className="app-input"
                    type="datetime-local"
                    value={preferredDate}
                    min={minMeetingDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontWeight: 700, fontSize: 13 }}>
                  Scans à déposer dans ce rendez-vous
                </label>
                <p className="app-muted" style={{ margin: "4px 0 8px", fontSize: 12 }}>
                  Sélectionnez un ou plusieurs scans. La demande sera refusée si le centre ne prend pas
                  tous les matériaux sélectionnés.
                </p>
                {scans.length === 0 ? (
                  <p className="app-muted" style={{ marginTop: 8 }}>
                    Aucun scan disponible pour le moment.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 260, overflow: "auto" }}>
                    {scans.map((scan) => {
                      const checked = selectedScanIds.includes(scan.id);
                      const incompatible =
                        selectedCenter && checked && !centerAcceptsMaterial(selectedCenter, scan.material);
                      return (
                        <label
                          key={scan.id}
                          className="app-card"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr",
                            gap: 10,
                            alignItems: "flex-start",
                            background: incompatible ? "#fff3f3" : "#ffffff",
                            borderColor: incompatible ? "#ffcdd2" : undefined,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleScan(scan.id)}
                            style={{ marginTop: 4 }}
                          />
                          <span>
                            <span style={{ fontWeight: 800 }}>{scan.label}</span>
                            <span className="app-muted" style={{ display: "block", marginTop: 3 }}>
                              Matière: <b>{formatMaterial(scan.material)}</b>
                              {scan.sortingClass ? ` · Classe: ${formatMaterial(scan.sortingClass)}` : ""}
                              {scan.points ? ` · Points: +${scan.points}` : ""}
                            </span>
                            {incompatible ? (
                              <span className="form-error" style={{ display: "block", marginTop: 6 }}>
                                Ce centre ne déclare pas accepter ce matériau.
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedScans.length > 0 ? (
                  <p className={incompatibleScans.length ? "form-error" : "form-info"} style={{ marginTop: 10 }}>
                    {incompatibleScans.length
                      ? `${incompatibleScans.length} scan(s) incompatible(s) avec ce centre.`
                      : `${selectedScans.length} scan(s) sélectionné(s), tous compatibles avec ce centre.`}
                  </p>
                ) : null}
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
                <button
                  className="app-btn app-btn-primary"
                  type="submit"
                  disabled={sending || incompatibleScans.length > 0 || (selectedCenter && !selectedCenter.canReceiveMeetings)}
                >
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
                      <div style={{ fontWeight: 900 }}>
                        Centre : {m.center?.centerName || "Fiche EcoScan"}
                        {m.center?.city ? (
                          <span className="app-muted" style={{ fontWeight: 500 }}>
                            {" "}
                            — {m.center.city}
                          </span>
                        ) : null}
                      </div>
                      <div className="badge">{m.status}</div>
                    </div>
                    <div className="app-muted" style={{ marginTop: 6 }}>
                      {m.preferredDate ? `Date: ${new Date(m.preferredDate).toLocaleString()}` : "Date: —"}
                    </div>
                    <MeetingScansList scans={m.scans?.length ? m.scans : m.scan ? [m.scan] : []} />
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
                    <MeetingScansList scans={m.scans?.length ? m.scans : m.scan ? [m.scan] : []} />
                    {m.message ? <div className="app-muted" style={{ marginTop: 6 }}>{m.message}</div> : null}
                    {m.status === "pending" ? (
                      <div className="app-row" style={{ marginTop: 10, gap: 8 }}>
                        <button
                          type="button"
                          className="app-btn app-btn-primary"
                          onClick={() => acceptMeeting(m)}
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          className="app-btn"
                          onClick={() => rejectMeeting(m)}
                        >
                          Refuser
                        </button>
                      </div>
                    ) : null}
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

