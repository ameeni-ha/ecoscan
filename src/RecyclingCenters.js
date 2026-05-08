import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import RecyclingCenterMap from "./components/RecyclingCenterMap";

function materialsFromCenter(c) {
  const raw = c.materialsAccepted;
  if (!raw && c.materials) {
    const s = String(c.materials);
    if (!s || s === "unknown") return [];
    return s
      .split(/[,;/]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/[,;/]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export default function RecyclingCenters() {
  const { isAuthenticated } = useAuth();

  const [city, setCity] = useState("");
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("country", city.trim() || "Tunisia");
      params.set("limit", "120");

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/osm-recycling-centers${suffix}`);
      setCenters(data.centers || []);
    } catch (e) {
      setError(e?.message || "Impossible de charger les centres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countByMaterial = useMemo(() => {
    const tally = {};
    centers.forEach((c) =>
      materialsFromCenter(c).forEach((m) => {
        tally[m] = (tally[m] || 0) + 1;
      }),
    );
    return tally;
  }, [centers]);

  return (
    <div className="app-page">
      <div className="app-container centers-page">
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="badge">🗺️ Cartographie</div>
          <h2 style={{ margin: "10px 0 6px" }}>Centres de recyclage ({centers.length} points)</h2>
          <p className="app-muted" style={{ lineHeight: 1.55, maxWidth: 720 }}>
            Données issues d’OpenStreetMap (points <code style={{ fontSize: 12 }}>amenity=recycling</code>).
            Zoomez sur la carte pour repérer l’itinéraire, puis consultez le détail terrain ci-dessous.
          </p>
          {!isAuthenticated ? (
            <p className="form-info" style={{ marginTop: 10 }}>
              Connectez-vous pour accéder au module rendez-vous et sauvegarder vos démarches depuis le tableau
              de bord.
            </p>
          ) : (
            <p className="form-info" style={{ marginTop: 10 }}>
              Besoin de planifier un dépôt ? Rendez-vous sur <strong>Rendez-vous</strong> après avoir copié
              l’identifiant ci-dessous.
            </p>
          )}

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <div style={{ marginTop: 14 }}>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Pays ou zone interrogée</label>
            <input
              className="app-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="ex : Tunisia ou un autre nom de pays pris en charge par Overpass"
            />
          </div>

          <div className="app-row" style={{ marginTop: 12 }}>
            <button className="app-btn app-btn-primary" type="button" onClick={load} disabled={loading}>
              {loading ? "Recherche…" : "Actualiser"}
            </button>
          </div>

          {Object.keys(countByMaterial).length ? (
            <div className="centers-material-overview" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Matériaux signalés dans ce jeu de données</div>
              <div className="forum-tag-row" style={{ marginTop: 8 }}>
                {Object.entries(countByMaterial)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 24)
                  .map(([material, qty]) => (
                    <span key={material} className="forum-tag">
                      {material} · {qty}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="app-card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <RecyclingCenterMap centers={centers} loading={loading} />
        </div>

        <div className="app-card">
          <h3 style={{ marginTop: 0 }}>Liste détaillée</h3>
          <p className="app-muted" style={{ marginTop: 0 }}>
            Chaque fiche résume coordonnées, matériaux, horaires et contact lorsque ces infos existent dans la
            base communautaire.
          </p>

          {loading ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Chargement…</p>
          ) : centers.length === 0 ? (
            <p className="app-muted" style={{ marginTop: 12 }}>Aucun centre trouvé.</p>
          ) : (
            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {centers.map((c) => {
                const mats = materialsFromCenter(c);
                const lat = typeof c.latitude === "number" ? c.latitude : null;
                const lon = typeof c.longitude === "number" ? c.longitude : null;
                const mapHref =
                  lat != null && lon != null
                    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
                    : null;

                return (
                  <div key={String(c.id)} className="app-card center-detail-card">
                    <div className="app-row" style={{ justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{c.centerName || "Point de recyclage"}</div>
                        {c.city ? (
                          <div className="app-muted" style={{ marginTop: 4 }}>
                            <strong>Ville / zone :</strong> {c.city}
                          </div>
                        ) : null}
                      </div>
                      {lat != null ? (
                        <div className="badge" style={{ whiteSpace: "nowrap" }}>
                          📍 lat {lat.toFixed(5)}
                          <br /> lon {lon != null ? lon.toFixed(5) : ""}
                        </div>
                      ) : null}
                    </div>

                    <dl className="center-dl-grid">
                      {c.managerName ? (
                        <>
                          <dt>Exploitant signalé</dt>
                          <dd>{c.managerName}</dd>
                        </>
                      ) : null}
                      {c.address ? (
                        <>
                          <dt>Adresse / voie OSM</dt>
                          <dd>{c.address}</dd>
                        </>
                      ) : null}
                      {c.district ? (
                        <>
                          <dt>Secteur</dt>
                          <dd>{c.district}</dd>
                        </>
                      ) : null}
                      <dt>Horaires / contact</dt>
                      <dd>
                        {c.openingHours ? <>{c.openingHours}</> : <>Non renseigné sur OSM.</>}
                        {c.phone ? (
                          <>
                            <br />
                            <strong>Téléphone:</strong> {c.phone}
                          </>
                        ) : null}
                      </dd>
                      <dt>Type</dt>
                      <dd>{c.centerType || "public/partner"} · {c.source || "community data"}</dd>
                      <dt>Identifiant interne EcoScan</dt>
                      <dd>
                        <code>{String(c.id)}</code>
                      </dd>
                    </dl>

                    {mats.length ? (
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>Flux acceptés ou signalés</span>
                        <div className="forum-tag-row" style={{ marginTop: 8 }}>
                          {mats.map((tag) => (
                            <span key={tag + c.id} className="forum-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="app-muted" style={{ marginTop: 10 }}>
                        Aucun matériau n’est étiqueté sur OSM pour ce point ; renseigner sur place lorsque vous
                        validez l’itinéraire.
                      </p>
                    )}

                    {c.description ? (
                      <p style={{ marginTop: 12, lineHeight: 1.55 }}>{c.description}</p>
                    ) : null}

                    <div className="app-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {mapHref ? (
                        <a className="app-btn center-map-link" href={mapHref} target="_blank" rel="noreferrer">
                          Carte interactive
                        </a>
                      ) : null}
                      {lat != null && lon != null ? (
                        <a
                          className="app-btn"
                          href={`https://maps.google.com/?q=${lat},${lon}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Navigation (Google Maps)
                        </a>
                      ) : null}
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
