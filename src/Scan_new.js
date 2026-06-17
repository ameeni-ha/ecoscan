import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import {
  detectObjects,
  suggestMaterial,
  loadModel,
} from "./utils/tensorflowUtils";

const MATERIAL_OPTIONS = [
  { value: "recyclable", label: "Recyclable" },
  { value: "recyclage_specialise", label: "Recyclage spécialisé" },
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
];

export default function Scan() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [label, setLabel] = useState("");
  const [material, setMaterial] = useState("recyclable");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  
  // Photo and detection
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);

  const materialLabel = useMemo(
    () => MATERIAL_OPTIONS.find((m) => m.value === material)?.label || material,
    [material]
  );

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiRequest("/scans/my", { token });
      setHistory(data.scans || []);
    } catch (e) {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load TensorFlow model on component mount
  useEffect(() => {
    setModelLoading(true);
    loadModel()
      .then(() => setModelLoading(false))
      .catch((err) => {
        console.error("Erreur lors du chargement du modèle:", err);
        setModelLoading(false);
      });
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 5 MB");
      return;
    }

    setPhoto(file);
    setError("");
    setDetectionResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDetectObject = async () => {
    if (!photoPreview) {
      setError("Veuillez d'abord télécharger une photo");
      return;
    }

    setDetecting(true);
    setError("");
    setDetectionResult(null);

    try {
      const img = new Image();
      img.src = photoPreview;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const predictions = await detectObjects(img);
      
      if (predictions && predictions.length > 0) {
        const suggestion = suggestMaterial(predictions);
        setDetectionResult(suggestion);

        if (suggestion.material) {
          setMaterial(suggestion.material);
          setLabel(
            label || suggestion.detectedObject || "Objet détecté"
          );
        } else {
          setError(
            `Objet détecté: ${suggestion.detectedObject} (${suggestion.confidence}% confiance) - Sélectionnez manuellement le matériau`
          );
        }
      } else {
        setError(
          "Aucun objet détecté. Veuillez essayer une autre photo ou entrez manuellement."
        );
      }
    } catch (err) {
      setError(
        err?.message || "Erreur lors de la détection. Veuillez réessayer."
      );
    } finally {
      setDetecting(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("label", label);
      formData.append("material", material);
      if (photo) {
        formData.append("photo", photo);
      }

      const data = await apiRequest("/scans", {
        method: "POST",
        token,
        body: formData,
        isFormData: true,
      });

      const id = data?.scan?.id;
      if (id) {
        navigate(`/scan/${id}`);
        return;
      }

      await loadHistory();
      setLabel("");
      setPhoto(null);
      setPhotoPreview(null);
      setDetectionResult(null);
    } catch (e2) {
      setError(e2?.message || "Impossible de scanner cet objet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="app-row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="badge">📷 Scan object</div>
              <h2 style={{ margin: "10px 0 6px" }}>Scanner un objet</h2>
              <div className="app-muted">
                Photographiez un objet ou décrivez-le manuellement pour connaître son matériau et
                recevoir des conseils de tri.
                {modelLoading && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#ff9800" }}>
                    ⏳ Chargement du modèle IA (première utilisation)...
                  </div>
                )}
              </div>
              <div className="app-muted" style={{ marginTop: 8 }}>
                Matériau: <b>{materialLabel}</b>
                {detectionResult && (
                  <div style={{ marginTop: 6, color: "#4caf50" }}>
                    ✓ Détecté: {detectionResult.detectedObject} ({detectionResult.confidence}%)
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

          <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
            {/* Photo Upload Section */}
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
              <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 8 }}>
                📸 Télécharger une photo (optionnel)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                disabled={modelLoading || detecting}
                style={{ marginBottom: 8 }}
              />
              
              {photoPreview && (
                <div style={{ marginTop: 12 }}>
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      borderRadius: 8,
                      marginBottom: 12,
                    }}
                  />
                  <div className="app-row" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="app-btn app-btn-primary"
                      onClick={handleDetectObject}
                      disabled={detecting || modelLoading}
                    >
                      {detecting ? "Détection..." : "🤖 Détecter l'objet"}
                    </button>
                    <button
                      type="button"
                      className="app-btn"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                        setDetectionResult(null);
                      }}
                    >
                      ✕ Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Input Section */}
            <div className="app-grid-2">
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Objet</label>
                <input
                  className="app-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="ex: bouteille, canette, carton…"
                  required
                />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13 }}>Matériau</label>
                <select
                  className="app-input"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  {MATERIAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="app-row" style={{ marginTop: 12 }}>
              <button className="app-btn app-btn-primary" disabled={loading} type="submit">
                {loading ? "Scan..." : "Lancer le scan"}
              </button>
              <button className="app-btn" type="button" onClick={loadHistory} disabled={historyLoading}>
                Rafraîchir
              </button>
            </div>
          </form>
        </div>

        <div className="app-card">
          <h3 style={{ marginTop: 0 }}>Historique</h3>
          {historyLoading ? (
            <p className="app-muted">Chargement…</p>
          ) : history.length === 0 ? (
            <p className="app-muted">Aucun scan pour le moment.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {history.map((scan) => (
                <button
                  key={scan.id}
                  type="button"
                  className="app-btn"
                  style={{ textAlign: "left" }}
                  onClick={() => navigate(`/scan/${scan.id}`)}
                >
                  <b>{scan.label}</b> — {scan.material} — {scan.recyclable ? "♻️ Recyclable" : "⚠️ À vérifier"} —{" "}
                  +{scan.points} pts
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
