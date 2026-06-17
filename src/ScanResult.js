import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { mediaUrl } from "./utils/apiUrls";
import { formatDateFr } from "./utils/formatDateFr";
import { canUseScan } from "./utils/permissions";

const MATERIAL_LABEL = {
  recyclable: "Recyclable",
  recyclage_specialise: "Recyclage spécialisé",
  plastique: "Plastique",
  verre: "Verre",
  papier_carton: "Papier / carton",
  metal: "Métal",
  electronique: "Électronique",
  organique: "Organique",
  autre: "Autre / non recyclable",
};

const formatRecyclingStatus = (scan) => {
  if (scan?.sortingClass === "recyclage_specialise" || scan?.material === "recyclage_specialise") {
    return "♻️ Recyclage spécialisé";
  }
  if (scan?.sortingClass === "non_recyclable") return "⚠️ Non recyclable (ou à confirmer)";
  return scan?.recyclable ? "♻️ Recyclable — à déposer proprement" : "⚠️ Non recyclable (ou à confirmer)";
};

export default function ScanResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [nearbyCenters, setNearbyCenters] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");

  useEffect(() => {
    if (!canUseScan(user)) {
      navigate("/dashboard", { replace: true });
      return undefined;
    }
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiRequest(`/scans/${id}`, { token });
        setScan(data.scan);
      } catch (e) {
        setError(e?.message || "Scan introuvable");
      } finally {
        setLoading(false);
      }
    };
    load();
    return undefined;
  }, [id, token, user, navigate]);

  useEffect(() => {
    if (!scan || scan.recyclable !== true) {
      setNearbyCenters([]);
      setGeoMessage("");
      return undefined;
    }

    setNearbyLoading(true);
    setGeoMessage("");
    setNearbyCenters([]);

    if (!navigator.geolocation) {
      setNearbyLoading(false);
      setGeoMessage(
        "Géolocalisation indisponible dans ce navigateur. Consultez « Centres » et la carte pour trouver un point de dépôt.",
      );
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNearbyLoading(false);
      setGeoMessage(
        "Délai de géolocalisation dépassé. Autorisez la position puis rechargez cette page.",
      );
    }, 14000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        window.clearTimeout(timeoutId);
        try {
          const { latitude, longitude } = pos.coords;
          const qs = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
            limit: "6",
          });
          if (scan.material) qs.set("material", scan.material);
          const data = await apiRequest(`/centers/nearby?${qs.toString()}`);
          const list = Array.isArray(data?.centers) ? data.centers : [];
          setNearbyCenters(list);
          setGeoMessage(
            list.length
              ? `${list.length} centre(s) proche(s), compatible(s) avec le matériau si renseigné en base.`
              : "Aucun centre enregistré dans EcoScan avec coordonnées et matériaux correspondants dans la région.",
          );
        } catch (e2) {
          setGeoMessage(e2?.message || "Impossible de charger les centres proches.");
          setNearbyCenters([]);
        } finally {
          setNearbyLoading(false);
        }
      },
      () => {
        window.clearTimeout(timeoutId);
        setNearbyLoading(false);
        setGeoMessage(
          "Position refusée. Activez la localisation pour voir les centres les plus proches, ou utilisez la page Centres.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );

    return () => window.clearTimeout(timeoutId);
  }, [scan]);

  const rdvNavigate = (centerId) => {
    const mt = MATERIAL_LABEL[scan?.material] || scan?.material || "matériau";
    const msg = `Suite au scan EcoScan « ${scan?.label || "objet"} » (${mt}).`;
    navigate(
      `/rendez-vous?center=${encodeURIComponent(centerId)}&scanIds=${encodeURIComponent(
        scan?.id || ""
      )}&message=${encodeURIComponent(msg)}`,
    );
  };

  const materialHuman = scan?.material ? MATERIAL_LABEL[scan.material] || scan.material : "";

  return (
    <div className="app-page">
      <div className="app-container scan-result-page">
        <div className="app-card">
          <div className="app-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                className="badge"
                style={{
                  background: scan?.recyclable ? "#e8f5e9" : "#fff8e6",
                  color: scan?.recyclable ? "#1b8f4f" : "#8a5a00",
                }}
              >
                {formatRecyclingStatus(scan)}
              </div>
              <h2 style={{ margin: "12px 0 6px", fontSize: 24 }}>
                Analyse : {scan?.label || "—"}
              </h2>
              <div className="app-muted">
                {scan?.createdAt ? `Enregistré le ${formatDateFr(scan.createdAt)}` : `Réf. scan ${id}`}
              </div>
            </div>
            <button className="app-btn" type="button" onClick={() => navigate("/scan")}>
              ← Nouveau scan
            </button>
          </div>

          {loading && <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>}
          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          {!loading && scan && (
            <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
              {scan.photoUrl ? (
                <div
                  className="app-card scan-result-photo"
                  style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(0,80,40,0.12)" }}
                >
                  <img
                    src={mediaUrl(scan.photoUrl)}
                    alt={scan.label || "Photo"}
                    style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }}
                  />
                </div>
              ) : null}

              <div
                className="app-card scan-result-summary"
                style={{ background: scan.recyclable ? "#f0faf5" : "#fffaf0" }}
              >
                <div className="app-row" style={{ justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div className="app-muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
                      Synthèse
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{scan.label}</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div
                      className="badge"
                      style={{
                        fontSize: 13,
                        background: scan.recyclable ? "#1b8f4f" : "#c47a00",
                        color: "#fff",
                      }}
                    >
                      {scan.sortingClass === "recyclage_specialise" || scan.material === "recyclage_specialise"
                        ? "Recyclage spécialisé"
                        : scan.sortingClass === "non_recyclable"
                        ? "Non recyclable / vérif"
                        : scan.recyclable
                        ? "Recyclable"
                        : "Non recyclable / vérif"}
                    </div>
                    <div style={{ marginTop: 10, fontWeight: 700, color: scan.recyclable ? "#138047" : "#8a6d3d" }}>
                      +{scan.points} pts
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span className="app-muted">Matériau : </span>
                  <strong>{materialHuman}</strong>
                </div>
                {(scan.detectedObject || scan.confidence || scan.detectionReason) ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                    {scan.detectedObject ? (
                      <div>
                        <span className="app-muted">Objet détecté par l'IA : </span>
                        <strong>{scan.detectedObject}</strong>
                      </div>
                    ) : null}
                    {scan.confidence ? (
                      <div>
                        <span className="app-muted">Confiance : </span>
                        <strong>{scan.confidence}%</strong>
                      </div>
                    ) : null}
                    {scan.detectionReason ? (
                      <div className="app-muted" style={{ lineHeight: 1.55 }}>
                        {scan.detectionReason}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!scan.recyclable ? (
                <div className="form-error" style={{ margin: 0 }}>
                  Pour cet objet, privilégiez la déchetterie ou un point spécialisé (suivez les consignes ci-dessous)
                  avant d’orienter vers un forum ou un lieu de collecte classique.
                </div>
              ) : (
                <p className="form-info" style={{ margin: 0 }}>
                  Objets identifiables comme <strong>recyclables</strong> : retrouvez des centres partenaires
                  proches (données EcoScan avec coordonnées GPS) puis demandez un rendez-vous.
                </p>
              )}

              <div className="app-card" style={{ background: "#ffffff" }}>
                <h3 style={{ marginTop: 0, marginBottom: 10 }}>Conseils de tri</h3>
                <p style={{ margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{scan.instructions}</p>
              </div>

              {scan.recyclable ? (
                <div className="app-card scan-nearby-centers">
                  <h3 style={{ marginTop: 0 }}>Centres les plus proches</h3>
                  <p className="app-muted" style={{ marginTop: 0 }}>
                    Liste basée sur votre position approximative et sur les fiches EcoScan géolocalisées.
                  </p>
                  {nearbyLoading ? (
                    <p className="app-muted">Calcul de votre position et recherche…</p>
                  ) : (
                    <>
                      {geoMessage ? (
                        <p className={nearbyCenters.length ? "form-info" : "app-muted"} style={{ marginTop: 8 }}>
                          {geoMessage}
                        </p>
                      ) : null}
                      {nearbyCenters.length > 0 ? (
                        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                          {nearbyCenters.map((c) => (
                            <div key={c.id} className="app-card nearby-center-row">
                              <div className="app-row" style={{ justifyContent: "space-between", gap: 10 }}>
                                <div>
                                  <div style={{ fontWeight: 900 }}>{c.centerName}</div>
                                  <div className="app-muted" style={{ marginTop: 4 }}>
                                    {typeof c.distanceKm === "number" ? `≈ ${c.distanceKm} km • ` : ""}
                                    {[c.city, c.district].filter(Boolean).join(" · ") || "Ville à préciser"}
                                  </div>
                                </div>
                                <span className="badge">{typeof c.distanceKm === "number" ? `${c.distanceKm} km` : "Prox."}</span>
                              </div>
                              {(c.address || c.phone || c.openingHours) ? (
                                <dl className="nearby-mini-dl">
                                  {c.address ? (
                                    <>
                                      <dt>Adresse</dt>
                                      <dd>{c.address}</dd>
                                    </>
                                  ) : null}
                                  {c.openingHours ? (
                                    <>
                                      <dt>Horaires</dt>
                                      <dd>{c.openingHours}</dd>
                                    </>
                                  ) : null}
                                  {c.phone ? (
                                    <>
                                      <dt>Téléphone</dt>
                                      <dd>{c.phone}</dd>
                                    </>
                                  ) : null}
                                </dl>
                              ) : null}
                              <div className="app-row scan-nearby-actions" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                <button
                                  type="button"
                                  className="app-btn app-btn-primary"
                                  onClick={() => rdvNavigate(c.id)}
                                >
                                  Prendre rendez-vous
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : !nearbyLoading ? (
                          <button
                            type="button"
                            className="app-btn app-btn-primary"
                            style={{ marginTop: 12 }}
                            onClick={() => navigate("/centres")}
                          >
                            Voir la carte des centres
                          </button>
                        ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="app-row" style={{ flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="app-btn app-btn-primary" onClick={() => navigate("/scan")}>
                  Scanner un autre objet
                </button>
                <button type="button" className="app-btn" onClick={() => navigate("/centres")}>
                  Carte tous centres
                </button>
                <button type="button" className="app-btn" onClick={() => navigate("/rendez-vous")}>
                  Rendez-vous
                </button>
                <button type="button" className="app-btn" onClick={() => navigate("/leaderboard")}>
                  Classement
                </button>
                <button type="button" className="app-btn" onClick={() => navigate("/forum")}>
                  Forum
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
