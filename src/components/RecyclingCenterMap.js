import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TUNISIA_CENTER = [34.0, 9.5];
const TUNISIA_ZOOM = 7;

const MATERIAL_LABELS = {
  plastic: "Plastique",
  plastique: "Plastique",
  paper: "Papier / carton",
  papier_carton: "Papier / carton",
  cardboard: "Carton",
  glass: "Verre",
  verre: "Verre",
  metal: "Métal",
  electronic: "Électronique",
  electronique: "Électronique",
  organic: "Organique",
  mixed: "Mixte",
};

const formatMaterials = (materials) =>
  Array.isArray(materials) && materials.length > 0
    ? materials.map((m) => MATERIAL_LABELS[m] || m).join(", ")
    : "Non précisé";

export function normalizeCenterCoords(center) {
  const lat = Number(center?.latitude ?? center?.lat);
  const lon = Number(center?.longitude ?? center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 30 || lat > 38.5 || lon < 7 || lon > 12.5) return null;
  return { lat, lon };
}

const greenRecyclingIcon = L.divIcon({
  className: "recycling-map-marker",
  html: `<div class="recycling-map-pin" aria-hidden="true">
    <span class="recycling-map-pin-icon">♻</span>
  </div>`,
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -40],
});

function MapBoundsFitter({ centers }) {
  const map = useMap();
  const points = useMemo(
    () =>
      centers
        .map((c) => normalizeCenterCoords(c))
        .filter(Boolean)
        .map((c) => [c.lat, c.lon]),
    [centers],
  );

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
  }, [map, points]);

  return null;
}

export default function RecyclingCenterMap({ centers, loading }) {
  const mappableCenters = useMemo(
    () => centers.filter((c) => normalizeCenterCoords(c)),
    [centers],
  );

  const mapCenter =
    mappableCenters.length > 0
      ? (() => {
          const c = normalizeCenterCoords(mappableCenters[0]);
          return c ? [c.lat, c.lon] : TUNISIA_CENTER;
        })()
      : TUNISIA_CENTER;

  const mapZoom = mappableCenters.length <= 1 ? 11 : TUNISIA_ZOOM;

  return (
    <div className="recycling-map-wrap">
      {!loading && centers.length > 0 && (
        <div className="recycling-map-legend">
          <span className="recycling-map-legend-dot" />
          {mappableCenters.length} centre(s) sur la carte
          {mappableCenters.length < centers.length && (
            <span className="recycling-map-legend-muted">
              {" "}
              · {centers.length - mappableCenters.length} sans coordonnées GPS
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="recycling-map-placeholder">
          <p>Chargement de la carte…</p>
        </div>
      ) : mappableCenters.length === 0 ? (
        <div className="recycling-map-placeholder">
          <p>Aucun centre avec position GPS à afficher</p>
        </div>
      ) : (
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          className="recycling-map-container"
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapBoundsFitter centers={mappableCenters} />
          {mappableCenters.map((center) => {
            const coords = normalizeCenterCoords(center);
            if (!coords) return null;
            const markerKey = String(center._id || center.id || `${coords.lat}-${coords.lon}`);
            return (
              <Marker
                key={markerKey}
                position={[coords.lat, coords.lon]}
                icon={greenRecyclingIcon}
              >
                <Popup>
                  <div className="recycling-map-popup">
                    <h4>{center.centerName || "Centre de recyclage"}</h4>
                    {center.city ? (
                      <p>
                        <b>{center.city}</b>
                        {center.district ? ` · ${center.district}` : ""}
                      </p>
                    ) : null}
                    {center.address && center.address !== "N/A" ? (
                      <p className="recycling-map-popup-muted">{center.address}</p>
                    ) : null}
                    {center.openingHours && center.openingHours !== "N/A" ? (
                      <p>⏰ {center.openingHours}</p>
                    ) : null}
                    {center.phone ? <p>📞 {center.phone}</p> : null}
                    {center.email ? <p>✉️ {center.email}</p> : null}
                    {center.website ? (
                      <p>
                        🌐{" "}
                        <a href={center.website} target="_blank" rel="noreferrer">
                          Site web
                        </a>
                      </p>
                    ) : null}
                    <p>
                      <b>Matériaux:</b> {formatMaterials(center.materialsAccepted)}
                    </p>
                    {center.capacityPerDayKg ? (
                      <p>
                        <b>Capacité:</b> {center.capacityPerDayKg} kg/jour
                      </p>
                    ) : null}
                    {center.rating ? (
                      <p>
                        <b>Note:</b> {center.rating}/5
                        {center.totalReviews ? ` (${center.totalReviews} avis)` : ""}
                      </p>
                    ) : null}
                    <p className="recycling-map-popup-muted">
                      GPS: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
                    </p>
                    {center.description ? (
                      <p className="recycling-map-popup-muted">{center.description}</p>
                    ) : null}
                    {center.source ? (
                      <p className="recycling-map-popup-source">{center.source}</p>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
