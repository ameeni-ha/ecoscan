import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Create custom green icon for recycling centers
const createRecyclingIcon = () => {
  return new L.Icon({
    iconUrl:
      "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

export default function RecyclingCenterMap({ centers, loading }) {
  const [mapCenter, setMapCenter] = useState([34.0, 9.0]); // Default: Tunisia
  const recyclingIcon = createRecyclingIcon();

  // Update map center based on centers
  useEffect(() => {
    if (centers.length > 0) {
      const centerWithCoords = centers.find((c) => c.latitude && c.longitude);
      if (centerWithCoords) {
        setMapCenter([centerWithCoords.latitude, centerWithCoords.longitude]);
      } else {
        // Calculate center of all centers
        const lats = centers
          .filter((c) => c.latitude)
          .map((c) => c.latitude);
        const lons = centers
          .filter((c) => c.longitude)
          .map((c) => c.longitude);
        if (lats.length > 0) {
          const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
          const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
          setMapCenter([avgLat, avgLon]);
        }
      }
    }
  }, [centers]);

  return (
    <div style={{ width: "100%", height: "500px", borderRadius: "8px", overflow: "hidden" }}>
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            backgroundColor: "#f5f5f5",
          }}
        >
          <p>Chargement de la carte…</p>
        </div>
      ) : centers.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            backgroundColor: "#f5f5f5",
          }}
        >
          <p>Aucun centre à afficher sur la carte</p>
        </div>
      ) : (
        <MapContainer
          center={mapCenter}
          zoom={centers.length > 0 ? 11 : 6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {centers.map((center) =>
            center.latitude && center.longitude ? (
              <Marker
                key={center._id || center.id}
                position={[center.latitude, center.longitude]}
                icon={recyclingIcon}
              >
                <Popup>
                  <div style={{ fontSize: "14px", minWidth: "250px" }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#27ae60" }}>
                      {center.centerName || "Centre de collecte"}
                    </h4>
                    {center.city && (
                      <p style={{ margin: "4px 0", display: "flex", alignItems: "center" }}>
                        <span style={{ marginRight: "6px" }}>📍</span>
                        <b>{center.city}</b>
                        {center.district ? ` - ${center.district}` : ""}
                      </p>
                    )}
                    {center.address && (
                      <p style={{ margin: "4px 0", fontSize: "12px", color: "#555" }}>
                        {center.address}
                      </p>
                    )}
                    {center.openingHours && (
                      <p style={{ margin: "4px 0", display: "flex", alignItems: "center" }}>
                        <span style={{ marginRight: "6px" }}>⏰</span>
                        {center.openingHours}
                      </p>
                    )}
                    {center.phone && (
                      <p style={{ margin: "4px 0", display: "flex", alignItems: "center" }}>
                        <span style={{ marginRight: "6px" }}>📞</span>
                        {center.phone}
                      </p>
                    )}
                    {center.materialsAccepted?.length > 0 && (
                      <p style={{ margin: "8px 0 0 0", fontSize: "12px" }}>
                        <b>Matériaux:</b> {center.materialsAccepted.join(", ")}
                      </p>
                    )}
                    {center.rating && (
                      <p style={{ margin: "4px 0", fontSize: "12px" }}>
                        ⭐ {center.rating.toFixed(1)}/5 ({center.totalReviews} avis)
                      </p>
                    )}
                    {center.capacityPerDayKg && (
                      <p style={{ margin: "4px 0", fontSize: "12px", color: "#27ae60" }}>
                        📦 Capacité: {center.capacityPerDayKg}kg/jour
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>
      )}
    </div>
  );
}
