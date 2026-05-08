import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { canUseScan } from "./utils/permissions";
import {
  detectObjects,
  suggestMaterial,
  loadModel,
} from "./utils/tensorflowUtils";

const MATERIAL_OPTIONS = [
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
];

export default function Scan() {
  const navigate = useNavigate();
  const { token, user, updateUser } = useAuth();
  const allowScan = canUseScan(user);

  const [label, setLabel] = useState("");
  const [material, setMaterial] = useState("plastique");
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
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
    if (!allowScan) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowScan]);

  useEffect(() => {
    if (!allowScan) return undefined;
    setModelLoading(true);
    loadModel()
      .then(() => setModelLoading(false))
      .catch((err) => {
        console.error("Erreur lors du chargement du modèle:", err);
        setModelLoading(false);
      });
    return undefined;
  }, [allowScan]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraLive(false);
  }, []);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

  const applyPhotoFile = useCallback((file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 5 MB");
      return;
    }

    stopCameraStream();
    setPhoto(file);
    setError("");
    setCameraError("");
    setDetectionResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  }, [stopCameraStream]);

  const handleFileChosen = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      applyPhotoFile(file);
    },
    [applyPhotoFile],
  );

  const startLiveCamera = useCallback(async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Caméra live indisponible (navigateur non compatible ou accès sécurité). Utilisez « Appareil photo » sur mobile.",
      );
      return;
    }
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const vid = videoRef.current;
      if (vid) {
        vid.srcObject = stream;
        await vid.play();
      }
      setCameraLive(true);
    } catch (err) {
      setCameraError(
        err?.message || "Accès caméra refusé. Autorisez la caméra ou choisissez une photo depuis la galerie.",
      );
    }
  }, [stopCameraStream]);

  const captureLiveFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("Patientez jusqu'à l'aperçu de la caméra, puis réessayez.");
      return;
    }
    setCameraError("");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Capture impossible pour cette image.");
          return;
        }
        const file = new File([blob], `capture_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        applyPhotoFile(file);
      },
      "image/jpeg",
      0.92,
    );
  }, [applyPhotoFile]);

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
      });

      if (data?.userPoints != null && user) {
        updateUser({ ...user, points: data.userPoints });
      }

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

  if (!allowScan) {
    return (
      <div className="app-page">
        <div className="app-container" style={{ maxWidth: 560 }}>
          <div className="app-card">
            <div className="badge">📷 Scan</div>
            <h2 style={{ marginTop: 10 }}>Fonction réservée aux collecteurs</h2>
            <p className="app-muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
              Les comptes <strong>centre de collecte</strong> ne peuvent pas lancer de scan. Utilisez le
              forum pour répondre aux questions et la page Centres pour informer sur les dépôts.
            </p>
            <div className="app-row" style={{ marginTop: 16 }}>
              <button className="app-btn app-btn-primary" type="button" onClick={() => navigate("/dashboard")}>
                Retour à mon espace
              </button>
              <button className="app-btn" type="button" onClick={() => navigate("/forum")}>
                Ouvrir le forum
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

            {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

            <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
              {/* Photo : galerie, caméra appareil, ou webcam */}
              <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
                <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 8 }}>
                  📸 Photo (optionnel)
                </label>
                <p className="app-muted" style={{ marginTop: 0, marginBottom: 10 }}>
                  Galerie fichier, ouverture caméra téléphone (« Appareil photo »), ou aperçu caméra depuis le navigateur (HTTPS /
                  localhost).
                </p>
                <div className="app-row scan-photo-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                  <label className="app-btn" style={{ cursor: "pointer", marginBottom: 0 }}>
                    Fichiers / Galerie
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleFileChosen}
                      disabled={modelLoading || detecting || loading}
                    />
                  </label>
                  <label className="app-btn app-btn-primary" style={{ cursor: "pointer", marginBottom: 0 }}>
                    Appareil photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={handleFileChosen}
                      disabled={modelLoading || detecting || loading}
                    />
                  </label>
                  {!cameraLive ? (
                    <button
                      type="button"
                      className="app-btn"
                      onClick={startLiveCamera}
                      disabled={modelLoading || detecting || loading}
                    >
                      Caméra navigateur
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="app-btn app-btn-primary"
                        onClick={captureLiveFrame}
                        disabled={detecting || loading}
                      >
                        Capturer l’aperçu
                      </button>
                      <button type="button" className="app-btn" onClick={stopCameraStream} disabled={loading}>
                        Arrêter la caméra
                      </button>
                    </>
                  )}
                </div>
                {cameraError ? <p className="form-error" style={{ marginTop: 10, marginBottom: 0 }}>{cameraError}</p> : null}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  style={{
                    display: cameraLive ? "block" : "none",
                    width: "100%",
                    maxHeight: 220,
                    marginTop: 12,
                    borderRadius: 8,
                    background: "#111",
                  }}
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

