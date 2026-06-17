import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import { useAuth } from "./context/AuthContext";
import { formatDateFr } from "./utils/formatDateFr";
import { canUseScan } from "./utils/permissions";
import {
  buildMobileNetSuggestionFromPredictions,
  detectObjectsWithMobileNetOnly,
  ELECTRONICS_MOBILENET_CLASSES,
  getWasteClassifierStatus,
  loadModel as loadMobileNetModel,
  predictWasteMaterial,
} from "./utils/tensorflowUtils";

const dataUrlToFile = async (dataUrl, filename = "scan.jpg") => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
};

const MATERIAL_OPTIONS = [
  { value: "recyclable", label: "Recyclable" },
  { value: "recyclage_specialise", label: "Recyclage spécialisé" },
  { value: "plastique", label: "Plastique" },
  { value: "verre", label: "Verre" },
  { value: "papier_carton", label: "Papier / Carton" },
  { value: "metal", label: "Métal" },
  { value: "electronique", label: "Électronique" },
  { value: "organique", label: "Organique" },
  { value: "autre", label: "Autre / non recyclable" },
];

const DATASET_CLASS_OPTIONS = [
  { value: "plastique_recyclable", label: "Plastique - recyclable", material: "plastique", recyclable: true, sortingClass: "recyclable" },
  { value: "verre_recyclable", label: "Verre - recyclable", material: "verre", recyclable: true, sortingClass: "recyclable" },
  { value: "papier_carton_recyclable", label: "Papier / carton - recyclable", material: "papier_carton", recyclable: true, sortingClass: "recyclable" },
  { value: "metal_recyclable", label: "Métal - recyclable", material: "metal", recyclable: true, sortingClass: "recyclable" },
  { value: "organique_recyclable", label: "Organique - recyclable", material: "organique", recyclable: true, sortingClass: "recyclable" },
  {
    value: "electronique_recyclage_specialise",
    label: "Électronique - recyclage spécialisé",
    material: "electronique",
    recyclable: true,
    sortingClass: "recyclage_specialise",
  },
  {
    value: "batterie_recyclage_specialise",
    label: "Pile / batterie - recyclage spécialisé",
    material: "electronique",
    recyclable: true,
    sortingClass: "recyclage_specialise",
  },
  { value: "autre_non_recyclable", label: "Autre - non recyclable", material: "autre", recyclable: false, sortingClass: "non_recyclable" },
];

const MATERIAL_TO_DATASET_CLASS = {
  recyclable: "plastique_recyclable",
  recyclage_specialise: "electronique_recyclage_specialise",
  plastique: "plastique_recyclable",
  verre: "verre_recyclable",
  papier_carton: "papier_carton_recyclable",
  metal: "metal_recyclable",
  electronique: "electronique_recyclage_specialise",
  organique: "organique_recyclable",
  autre: "autre_non_recyclable",
};

const limitText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const UNCERTAIN_KERAS_STATUS = /ambiguous|low_confidence|unknown/i;
const MIN_RELIABLE_CONFIDENCE = 60;
const PYTHON_MOBILENET_FIRST_MODE = true;

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image."));
    img.src = src;
  });

const withTimeout = (promise, timeoutMs, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);

const mergeHybridPrediction = (kerasPrediction, mobileNetSuggestion) => {
  const tmConf = kerasPrediction?.confidence || 0;
  const tmStatus = kerasPrediction?.detectionStatus || "";
  const tmIsReliable =
    tmConf >= MIN_RELIABLE_CONFIDENCE && !UNCERTAIN_KERAS_STATUS.test(tmStatus);

  if (kerasPrediction && tmIsReliable) {
    const isPythonModel = String(kerasPrediction.modelSource || "").includes("python");
    const primaryModelName = isPythonModel ? "MobileNetV2 Python" : "Teachable Machine";
    const material = kerasPrediction.material || "autre";
    const recyclable = Boolean(kerasPrediction.recyclable);
    const sortingClass =
      kerasPrediction.sortingClass ||
      (material === "recyclage_specialise"
        ? "recyclage_specialise"
        : recyclable
        ? "recyclable"
        : "non_recyclable");

    return {
      ...kerasPrediction,
      material,
      recyclable,
      sortingClass,
      reason: mobileNetSuggestion?.detectedObject
        ? `${primaryModelName} prioritaire : ${
            kerasPrediction.reason || "classification estimée par le modèle personnalisé."
          } MobileNet détecte aussi : ${mobileNetSuggestion.detectedObject} (${Math.round(
            mobileNetSuggestion.confidence || 0
          )}%).`
        : kerasPrediction.reason,
      detectionStatus: isPythonModel ? "python_mobilenet_first" : "teachable_machine_fallback",
      modelSource: mobileNetSuggestion
        ? isPythonModel
          ? "python-mobilenet-first-hybrid"
          : "teachable-machine-fallback-hybrid"
        : kerasPrediction.modelSource || "custom",
      topPredictions: kerasPrediction.topPredictions || [],
      mobileNetObject: mobileNetSuggestion?.rawDetectedObject || "",
      allMobileNetTop: mobileNetSuggestion?.allMobileNetTop || "",
      uncertain: false,
    };
  }

  if (mobileNetSuggestion) {
    const mobileNetConf = mobileNetSuggestion.confidence || 0;
    const mobileNetMaterial = mobileNetSuggestion.material || "autre";
    const mobileNetRaw = String(mobileNetSuggestion.rawDetectedObject || "").toLowerCase();
    const mobileNetIsKnown =
      mobileNetMaterial !== "autre" ||
      mobileNetSuggestion.detectionStatus === "mobilenet_specialized_recycling" ||
      ELECTRONICS_MOBILENET_CLASSES.has(mobileNetRaw);
    const recyclable = Boolean(mobileNetSuggestion.recyclable);
    const sortingClass =
      mobileNetMaterial === "recyclage_specialise" || mobileNetMaterial === "electronique"
        ? "recyclage_specialise"
        : recyclable
        ? "recyclable"
        : "non_recyclable";

    return {
      ...(kerasPrediction || {}),
      material: mobileNetMaterial,
      confidence: mobileNetConf,
      detectedObject: mobileNetSuggestion.detectedObject || "Objet détecté",
      rawDetectedObject: mobileNetSuggestion.rawDetectedObject || "",
      recyclable,
      sortingClass,
      detectionStatus: mobileNetSuggestion.detectionStatus || "mobilenet_fallback",
      reason: `Modèle déchets incertain ou indisponible, MobileNet utilisé en secours : ${
        mobileNetSuggestion.reason || "classification estimée par TensorFlow MobileNet."
      }${
        kerasPrediction?.detectedObject
          ? ` Le modèle déchets indique aussi : ${kerasPrediction.detectedObject} (${Math.round(tmConf)}%).`
          : ""
      }`,
      modelSource: kerasPrediction ? "tensorflow-mobilenet-fallback" : "tensorflow-mobilenet",
      topPredictions: kerasPrediction?.topPredictions || [],
      mobileNetObject: mobileNetSuggestion.rawDetectedObject || "",
      allMobileNetTop: mobileNetSuggestion.allMobileNetTop || "",
      uncertain: !mobileNetIsKnown && mobileNetConf < 45,
    };
  }

  if (!kerasPrediction) return null;

  const kerasConf = kerasPrediction.confidence || 0;
  let detectedObject = kerasPrediction.detectedObject;
  let material = kerasPrediction.material || "autre";
  let recyclable = Boolean(kerasPrediction.recyclable);
  let sortingClass =
    kerasPrediction.sortingClass ||
    (material === "recyclage_specialise"
      ? "recyclage_specialise"
      : recyclable
      ? "recyclable"
      : "non_recyclable");
  let reason = kerasPrediction.reason || "";
  let detectionStatus = kerasPrediction.detectionStatus || "python_keras";
  const kerasDecisionIsReliable =
    kerasConf >= MIN_RELIABLE_CONFIDENCE && !UNCERTAIN_KERAS_STATUS.test(detectionStatus);

  const isUncertain =
    !kerasDecisionIsReliable;

  if (isUncertain) {
    material = "autre";
    recyclable = false;
    sortingClass = "non_recyclable";
    reason =
      "Résultat incertain : le modèle hésite. Corrigez la vraie classe ou ajoutez plus d'images au dataset.";
    detectionStatus = "hybrid_uncertain";
  }

  return {
    ...kerasPrediction,
    detectedObject,
    material,
    recyclable,
    sortingClass,
    reason,
    detectionStatus,
    modelSource: mobileNetSuggestion ? "hybrid-python-mobilenet" : kerasPrediction.modelSource || "custom",
    topPredictions: kerasPrediction.topPredictions || [],
    mobileNetObject: "",
    allMobileNetTop: "",
    uncertain: isUncertain,
  };
};

const CENTER_MATERIAL_LABELS = {
  recyclable: "Recyclable",
  recyclage_specialise: "Recyclage spécialisé",
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

const IMPACT_FACTORS = {
  recyclable: { plasticKg: 0, co2Kg: 0.04 },
  recyclage_specialise: { plasticKg: 0, co2Kg: 0.12 },
  plastique: { plasticKg: 0.04, co2Kg: 0.08 },
  verre: { plasticKg: 0, co2Kg: 0.03 },
  papier_carton: { plasticKg: 0, co2Kg: 0.05 },
  metal: { plasticKg: 0, co2Kg: 0.15 },
  electronique: { plasticKg: 0, co2Kg: 0.2 },
  organique: { plasticKg: 0, co2Kg: 0.02 },
  autre: { plasticKg: 0, co2Kg: 0 },
};

const formatImpactNumber = (value, digits = 2) =>
  Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const isUncertainDetection = (result) =>
  Boolean(result?.uncertain) ||
  UNCERTAIN_KERAS_STATUS.test(result?.detectionStatus || "") ||
  result?.detectionStatus === "hybrid_uncertain" ||
  (Number(result?.confidence || 0) > 0 && Number(result?.confidence || 0) < MIN_RELIABLE_CONFIDENCE);

const formatRecyclingStatus = (result) => {
  if (result?.sortingClass === "recyclage_specialise" || result?.material === "recyclage_specialise") {
    return "♻️ Recyclage spécialisé";
  }
  if (result?.sortingClass === "non_recyclable") return "⚠️ Non recyclable";
  return result?.recyclable ? "♻️ Recyclable" : "⚠️ Non recyclable";
};

const formatCenterMaterials = (materials) =>
  Array.isArray(materials) && materials.length > 0
    ? materials.map((m) => CENTER_MATERIAL_LABELS[m] || m).join(", ")
    : "Non précisé";

const TUNISIA_BOUNDS = {
  minLat: 30.0,
  maxLat: 37.8,
  minLng: 7.0,
  maxLng: 12.2,
};

const isInTunisia = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= TUNISIA_BOUNDS.minLat &&
  lat <= TUNISIA_BOUNDS.maxLat &&
  lng >= TUNISIA_BOUNDS.minLng &&
  lng <= TUNISIA_BOUNDS.maxLng;

const distanceKm = (fromLat, fromLng, toLat, toLng) => {
  const earthRadiusKm = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) *
      Math.cos(toRad(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function Scan() {
  const navigate = useNavigate();
  const { token, user, updateUser } = useAuth();
  const allowScan = canUseScan(user);

  const [label, setLabel] = useState("");
  const [material, setMaterial] = useState("plastique");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Photo and detection
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [correctionClass, setCorrectionClass] = useState("plastique");
  const [datasetSaving, setDatasetSaving] = useState(false);

  // Nearby recycling centers
  const [nearbyCenters, setNearbyCenters] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const barcodeCandidateRef = useRef({ value: "", count: 0 });
  const liveDetectionStreakRef = useRef({ object: "", count: 0 });
  const labelRef = useRef(label);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  useEffect(() => {
    if (!detectionResult) return;
    const raw = detectionResult.rawDetectedObject || "";
    const fromRaw = DATASET_CLASS_OPTIONS.find((item) => item.value === raw);
    if (fromRaw) {
      setCorrectionClass(fromRaw.value);
      return;
    }
    const fromMaterial = MATERIAL_TO_DATASET_CLASS[detectionResult.material];
    if (fromMaterial) {
      setCorrectionClass(fromMaterial);
    }
  }, [detectionResult]);

  useEffect(() => {
    if (!barcodeResult) return;
    setDetectionResult((current) => ({
      ...(current || {}),
      material,
      confidence: 100,
      detectedObject: `Code-barres ${barcodeResult.value}`,
      rawDetectedObject: barcodeResult.value,
      recyclable: material !== "autre",
      detectionStatus: "barcode",
      reason:
        "Code-barres détecté. La matière est renseignée manuellement pour calculer la recyclabilité et les points.",
      modelSource: "barcode-detector",
      topPredictions: [],
    }));
    setLabel(`Code-barres ${barcodeResult.value}`);
  }, [barcodeResult, material]);

  const materialLabel = useMemo(
    () => MATERIAL_OPTIONS.find((m) => m.value === material)?.label || material,
    [material]
  );

  const getMaterialLabel = useCallback(
    (value) => MATERIAL_OPTIONS.find((m) => m.value === value)?.label || value || "Non précisé",
    []
  );

  const impactSummary = useMemo(() => {
    const recyclableScans = history.filter((scan) => scan.recyclable);

    return recyclableScans.reduce(
      (summary, scan) => {
        const materialKey = scan.material || "autre";
        const factors = IMPACT_FACTORS[materialKey] || IMPACT_FACTORS.autre;
        const points = Number(scan.points || 0);

        return {
          recyclableCount: summary.recyclableCount + 1,
          plasticCount: summary.plasticCount + (materialKey === "plastique" ? 1 : 0),
          plasticKg: summary.plasticKg + factors.plasticKg,
          co2Kg: summary.co2Kg + factors.co2Kg,
          points: summary.points + points,
        };
      },
      {
        recyclableCount: 0,
        plasticCount: 0,
        plasticKg: 0,
        co2Kg: 0,
        points: 0,
      }
    );
  }, [history]);

  const loadCompatibleCenters = useCallback(
    async (materialValue, coords = null) => {
      try {
        const localParams = new URLSearchParams({
          limit: "0",
          includeUnverified: "true",
        });
        if (materialValue) localParams.set("material", materialValue);

        const osmParams = new URLSearchParams({ limit: "100" });

        const [localData, osmData] = await Promise.all([
          apiRequest(`/centers?${localParams.toString()}`),
          apiRequest(`/osm-recycling-centers?${osmParams.toString()}`),
        ]);

        const localCenters = (localData.centers || [])
          .filter((center) =>
            isInTunisia(Number(center.latitude), Number(center.longitude))
          )
          .map((center) => ({ ...center, source: "EcoScan Tunisie" }));

        const osmCenters = (osmData.centers || []).map((center) => ({
          ...center,
          source: center.source || "OpenStreetMap Tunisie",
        }));

        const seen = new Set();
        const merged = [];

        for (const center of [...localCenters, ...osmCenters]) {
          const lat = Number(center.latitude);
          const lng = Number(center.longitude);
          if (!isInTunisia(lat, lng)) continue;

          const key =
            center.id ||
            center._id ||
            `${lat.toFixed(5)},${lng.toFixed(5)}:${center.centerName || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const distance =
            coords && isInTunisia(coords.lat, coords.lng)
              ? Number(distanceKm(coords.lat, coords.lng, lat, lng).toFixed(2))
              : null;

          merged.push({
            ...center,
            latitude: lat,
            longitude: lng,
            distanceKm: distance,
          });
        }

        const list = merged
          .sort((a, b) => {
            if (a.distanceKm == null && b.distanceKm == null) return 0;
            if (a.distanceKm == null) return 1;
            if (b.distanceKm == null) return -1;
            return a.distanceKm - b.distanceKm;
          })
          .slice(0, 6);

        setNearbyCenters(list);
        setGeoMessage(
          list.length
            ? `${list.length} centre(s) en Tunisie ${coords ? "trié(s) par distance" : "compatible(s) avec le scan"}.`
            : ""
        );
      } catch {
        setNearbyCenters([]);
        setGeoMessage("");
      }
    },
    []
  );

  const openMeetingRequest = useCallback(
    (center) => {
      const objectName = labelRef.current || detectionResult?.detectedObject || "objet recyclable";
      const materialName = getMaterialLabel(detectionResult?.material || material);
      const message = `Suite à mon scan EcoScan : ${objectName} (${materialName}). Je souhaite vous contacter pour un rendez-vous de dépôt.`;

      navigate(
        `/rendez-vous?center=${encodeURIComponent(center.id)}&message=${encodeURIComponent(message)}`
      );
    },
    [detectionResult, getMaterialLabel, material, navigate]
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

  const handleDeleteScan = async (scanId, scanPoints) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce scan ? Les points associés seront également retirés.")) {
      return;
    }

    try {
      await apiRequest(`/scans/${scanId}`, {
        method: "DELETE",
        token,
      });

      // Mettre à jour les points de l'utilisateur
      if (user && scanPoints > 0) {
        updateUser({ ...user, points: (user.points || 0) - scanPoints });
      }

      // Recharger l'historique
      await loadHistory();
    } catch (e) {
      setError(e?.message || "Impossible de supprimer ce scan");
    }
  };

  useEffect(() => {
    if (!allowScan) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowScan]);

  useEffect(() => {
    if (!allowScan) return undefined;

    let cancelled = false;
    setModelLoading(true);

    loadMobileNetModel()
      .then(() => {
        if (cancelled) return;
        const browserStatus = getWasteClassifierStatus();
        if (browserStatus.customModelAvailable && !browserStatus.labelMismatch) {
          setModelStatus((prev) => ({
            ...prev,
            browserModelAvailable: true,
          }));
          setError("");
        }
      })
      .catch(() => {
        // MobileNet optional: hybrid still works with browser waste model or Python
      });

    fetch(`${process.env.REACT_APP_API_URL || "http://localhost:4000/api"}/ai/health`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setModelStatus((prev) => ({
            ...prev,
            pythonBackendAvailable: true,
            labels: data?.ai?.labels,
          }));
        } else {
          setModelStatus((prev) => ({ ...prev, pythonBackendUnavailable: true }));
          const browserOk = getWasteClassifierStatus();
          if (!browserOk.customModelAvailable || browserOk.labelMismatch) {
            setError(data?.message || "Service IA Python indisponible. Lancez: npm run ai");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelStatus((prev) => ({ ...prev, pythonBackendUnavailable: true }));
          const browserOk = getWasteClassifierStatus();
          if (!browserOk.customModelAvailable || browserOk.labelMismatch) {
            setError("Impossible de joindre le service IA. Lancez npm run ai puis npm run api.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setModelLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [allowScan]);

  const stopCameraStream = useCallback(() => {
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // ignore reset errors
      }
      zxingReaderRef.current = null;
    }
    barcodeCandidateRef.current = { value: "", count: 0 };
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraLive(false);
    setBarcodeScanning(false);
  }, []);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

  const runLiveDetection = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    try {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }
    } catch (err) {
      console.error("Erreur lors de l'aperçu caméra:", err);
    }
  }, []);

  useEffect(() => {
    if (cameraLive) {
      detectionIntervalRef.current = setInterval(() => {
        runLiveDetection();
      }, 900);
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [cameraLive, runLiveDetection]);

  // Load nearby recycling centers when a recyclable material is detected
  useEffect(() => {
    if (!detectionResult || !detectionResult.material || detectionResult.recyclable !== true) {
      setNearbyCenters([]);
      setGeoMessage("");
      return;
    }

    setNearbyLoading(true);
    setGeoMessage("");
    setNearbyCenters([]);

    if (!navigator.geolocation) {
      loadCompatibleCenters(detectionResult.material).finally(() => setNearbyLoading(false));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNearbyLoading(false);
      setGeoMessage(
        "Délai de géolocalisation dépassé. Autorisez la position puis réessayez."
      );
    }, 14000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        window.clearTimeout(timeoutId);
        try {
          const { latitude, longitude } = pos.coords;
          if (!isInTunisia(latitude, longitude)) {
            await loadCompatibleCenters(detectionResult.material);
            return;
          }

          const qs = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
            limit: "6",
          });
          if (detectionResult.material) qs.set("material", detectionResult.material);
          const data = await apiRequest(`/centers/nearby?${qs.toString()}`);
          const list = Array.isArray(data?.centers) ? data.centers : [];
          if (list.length === 0) {
            await loadCompatibleCenters(detectionResult.material, {
              lat: latitude,
              lng: longitude,
            });
            return;
          }

          const tunisiaCenters = list.filter((center) =>
            isInTunisia(Number(center.latitude), Number(center.longitude))
          );

          if (tunisiaCenters.length === 0) {
            await loadCompatibleCenters(detectionResult.material, {
              lat: latitude,
              lng: longitude,
            });
            return;
          }

          setNearbyCenters(tunisiaCenters);
          setGeoMessage(
            tunisiaCenters.length
              ? `${tunisiaCenters.length} centre(s) proche(s) en Tunisie compatible(s) avec le matériau détecté.`
              : ""
          );
        } catch {
          await loadCompatibleCenters(detectionResult.material);
        } finally {
          setNearbyLoading(false);
        }
      },
      () => {
        window.clearTimeout(timeoutId);
        loadCompatibleCenters(detectionResult.material).finally(() => setNearbyLoading(false));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );

    return () => window.clearTimeout(timeoutId);
  }, [detectionResult, loadCompatibleCenters]);

  const applyPhotoFile = useCallback((file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 5 MB");
      return;
    }

    stopCameraStream();
    setPhoto(file);
    setError("");
    setSuccess("");
    setCameraError("");
    setBarcodeError("");
    setBarcodeResult(null);
    setDetectionResult(null);
    liveDetectionStreakRef.current = { object: "", count: 0 };
    setLabel("");
    setMaterial("autre");

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  }, [stopCameraStream]);

  const resolvePhotoFile = useCallback(async () => {
    if (photo) return photo;
    if (!photoPreview) {
      throw new Error("Veuillez d'abord prendre ou choisir une photo.");
    }
    return dataUrlToFile(photoPreview, `scan_${Date.now()}.jpg`);
  }, [photo, photoPreview]);

  const analyzeCurrentPhoto = useCallback(async () => {
    if (!photoPreview) {
      throw new Error("Veuillez d'abord prendre ou choisir une photo.");
    }

    const file = await resolvePhotoFile();
    const img = await loadImageElement(photoPreview);
    const errors = [];

    const runTeachableMachineClassifier = async () => {
      try {
        const browserPrediction = await predictWasteMaterial(img);
        if (browserPrediction) {
          return browserPrediction;
        }
      } catch (err) {
        console.warn("Teachable Machine navigateur:", err);
        errors.push(`Modèle navigateur: ${err?.message || "erreur inconnue"}`);
      }

      return null;
    };

    const runPythonMaterialClassifier = async () => {
      try {
        const formData = new FormData();
        formData.append("photo", file);
        const data = await apiRequest("/scans/predict", {
          method: "POST",
          token,
          body: formData,
          timeoutMs: 25000,
        });
        const prediction = data?.prediction;
        if (!prediction) return null;
        return {
          material: prediction.material || "autre",
          confidence: prediction.confidence || 0,
          detectedObject: prediction.detectedObject || prediction.label || "Objet détecté",
          rawDetectedObject: prediction.rawDetectedObject || "",
          recyclable: Boolean(prediction.recyclable),
          detectionStatus: prediction.detectionStatus || "python_keras",
          reason: prediction.reason || "",
          modelSource: prediction.modelSource || "python-keras",
          topPredictions: prediction.topPredictions || [],
        };
      } catch (err) {
        console.warn("Service Python Keras:", err);
        errors.push(`Service IA (Python): ${err?.message || "erreur inconnue"}`);
        return null;
      }
    };

    const runMobileNet = async () => {
      try {
        await withTimeout(
          loadMobileNetModel(),
          10000,
          "Chargement MobileNet trop long."
        );
        const predictions = await withTimeout(
          detectObjectsWithMobileNetOnly(img),
          10000,
          "Analyse MobileNet trop longue."
        );
        if (!predictions?.length) return null;
        return buildMobileNetSuggestionFromPredictions(predictions);
      } catch (err) {
        console.warn("MobileNet:", err);
        errors.push(`MobileNet: ${err?.message || "erreur inconnue"}`);
        return null;
      }
    };

    const pythonPrediction = PYTHON_MOBILENET_FIRST_MODE
      ? await runPythonMaterialClassifier()
      : null;

    let kerasPrediction = pythonPrediction;

    if (pythonPrediction) {
      const suggestion = mergeHybridPrediction(pythonPrediction, null);
      if (!isUncertainDetection(suggestion)) {
        setModelStatus((prev) => ({
          ...prev,
          hybrid: false,
          browserModelAvailable: prev?.browserModelAvailable,
          pythonBackendAvailable: true,
          mobileNetOnly: false,
        }));
        setDetectionResult(suggestion);
        setMaterial(suggestion.material || "autre");
        setLabel(suggestion.detectedObject || "Objet détecté");
        return suggestion;
      }
    }

    const tmPrediction = await runTeachableMachineClassifier();
    if (tmPrediction) {
      const suggestion = mergeHybridPrediction(tmPrediction, null);
      if (!isUncertainDetection(suggestion)) {
        setModelStatus((prev) => ({
          ...prev,
          hybrid: false,
          browserModelAvailable: true,
          pythonBackendAvailable: prev?.pythonBackendAvailable,
          mobileNetOnly: false,
        }));
        setDetectionResult(suggestion);
        setMaterial(suggestion.material || "autre");
        setLabel(suggestion.detectedObject || "Objet détecté");
        return suggestion;
      }
      kerasPrediction = kerasPrediction || tmPrediction;
    }

    if (!kerasPrediction) {
      kerasPrediction = PYTHON_MOBILENET_FIRST_MODE
        ? null
        : await runPythonMaterialClassifier();
    }

    const mobileNetSuggestion = await runMobileNet();

    const suggestion = mergeHybridPrediction(kerasPrediction, mobileNetSuggestion);
    if (suggestion && !mobileNetSuggestion) {
      suggestion.allMobileNetTop =
        "Aucun objet MobileNet fiable — attendez le chargement du modèle ou cadrez l'objet seul, sans mains.";
    }
    if (!suggestion) {
      const debugHint = errors.length ? ` Détails: ${errors.join(" | ")}` : "";
      throw new Error(
        kerasPrediction === null
          ? `Analyse impossible. Lancez npm run ai ou vérifiez le modèle navigateur.${debugHint}`
          : "Le service IA n'a renvoyé aucun résultat."
      );
    }

    if (kerasPrediction) {
      const fromBrowser = kerasPrediction.modelSource === "custom";
      setModelStatus((prev) => ({
        ...prev,
        hybrid: true,
        browserModelAvailable: fromBrowser || prev?.browserModelAvailable,
        pythonBackendAvailable: !fromBrowser || prev?.pythonBackendAvailable,
        mobileNetOnly: false,
      }));
    } else {
      setModelStatus((prev) => ({ ...prev, mobileNetOnly: true }));
    }

    setDetectionResult(suggestion);
    setMaterial(suggestion.material || "autre");
    setLabel(suggestion.detectedObject || "Objet détecté");
    return suggestion;
  }, [photoPreview, resolvePhotoFile, token]);

  useEffect(() => {
    if (
      !photoPreview ||
      !allowScan ||
      !token ||
      modelLoading ||
      (!modelStatus?.browserModelAvailable &&
        !modelStatus?.pythonBackendAvailable &&
        modelStatus?.pythonBackendUnavailable)
    ) {
      return undefined;
    }

    let cancelled = false;

    const runAnalysis = async () => {
      setDetecting(true);
      setError("");
      setDetectionResult(null);

      try {
        const result = await analyzeCurrentPhoto();
        if (cancelled) return;
        setSuccess(
          result.recyclable
            ? "Analyse terminée : objet recyclable détecté. Cliquez sur Enregistrer ce scan."
            : "Analyse terminée : objet non recyclable ou à vérifier. Vous pouvez enregistrer le scan."
        );
      } catch (err) {
        if (!cancelled) {
          setModelStatus({ pythonBackendUnavailable: true });
          setError(
            err?.message ||
              "Analyse IA impossible. Vérifiez que npm run ai et npm run api sont lancés."
          );
        }
      } finally {
        if (!cancelled) setDetecting(false);
      }
    };

    runAnalysis();
    return () => {
      cancelled = true;
    };
  }, [
    photoPreview,
    allowScan,
    token,
    modelLoading,
    modelStatus?.browserModelAvailable,
    modelStatus?.pythonBackendAvailable,
    modelStatus?.pythonBackendUnavailable,
    analyzeCurrentPhoto,
  ]);

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
    setBarcodeError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Caméra live indisponible (navigateur non compatible ou accès sécurité). Utilisez « Appareil photo » sur mobile.",
      );
      return;
    }
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraLive(true);

      setTimeout(async () => {
        const vid = videoRef.current;
        if (vid) {
          vid.srcObject = stream;
          try {
            await vid.play();
          } catch (playErr) {
            console.error("Error playing video:", playErr);
          }
        }
      }, 100);
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

  const applyCorrectionToResult = useCallback((datasetClassValue) => {
    const option = DATASET_CLASS_OPTIONS.find((item) => item.value === datasetClassValue);
    if (!option) return null;

    return {
      material: option.material,
      confidence: 100,
      detectedObject: option.label,
      rawDetectedObject: option.value,
      recyclable: option.recyclable,
      sortingClass:
        option.sortingClass ||
        (option.material === "recyclage_specialise"
          ? "recyclage_specialise"
          : option.recyclable
          ? "recyclable"
          : "non_recyclable"),
      detectionStatus: "user_corrected",
      reason: "Classe corrigée par l'utilisateur et ajoutée au dataset d'entraînement.",
      modelSource: "user-correction",
      topPredictions: [],
    };
  }, []);

  const handleAddToDataset = async () => {
    if (!photoPreview) {
      setError("Prenez une photo avant d'ajouter une correction au dataset.");
      return;
    }

    setDatasetSaving(true);
    setError("");

    try {
      const file = await resolvePhotoFile();
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("datasetClass", correctionClass);
      if (detectionResult?.rawDetectedObject) {
        formData.append("predictedClass", detectionResult.rawDetectedObject);
      }

      const data = await apiRequest("/scans/dataset-feedback", {
        method: "POST",
        token,
        body: formData,
      });

      const corrected = applyCorrectionToResult(correctionClass);
      if (corrected) {
        setDetectionResult(corrected);
        setMaterial(corrected.material);
        setLabel(corrected.detectedObject);
      }

      setSuccess(
        `${data?.message || "Photo ajoutée au dataset."} Puis lancez: venv\\Scripts\\python.exe train_waste_model.py et redémarrez npm run ai.`
      );
    } catch (err) {
      setError(err?.message || "Impossible d'ajouter cette photo au dataset.");
    } finally {
      setDatasetSaving(false);
    }
  };

  const handleDetectObject = async () => {
    setDetecting(true);
    setError("");
    setSuccess("");
    setDetectionResult(null);

    try {
      const result = await analyzeCurrentPhoto();
      const hybridNote = result.modelSource === "hybrid-python-mobilenet" ? " (objet + matière)" : "";
      setSuccess(
        result.recyclable
          ? `Analyse terminée${hybridNote} : ${result.detectedObject} recyclable. Enregistrez le scan.`
          : `Analyse terminée${hybridNote} : ${result.detectedObject}. Vérifiez puis enregistrez le scan.`
      );
    } catch (err) {
      setModelStatus({ pythonBackendUnavailable: true });
      setError(
        err?.message ||
          "Analyse IA impossible. Vérifiez que npm run ai et npm run api sont lancés."
      );
    } finally {
      setDetecting(false);
    }
  };

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      let resultToSave = detectionResult;
      if (!resultToSave) {
        if (barcodeResult) {
          const barcodeSortingClass =
            material === "recyclage_specialise"
              ? "recyclage_specialise"
              : material === "autre"
              ? "non_recyclable"
              : "recyclable";
          resultToSave = {
            material,
            confidence: 100,
            detectedObject: `Code-barres ${barcodeResult.value}`,
            rawDetectedObject: barcodeResult.value,
            recyclable: material !== "autre",
            sortingClass: barcodeSortingClass,
            detectionStatus: "barcode",
            reason:
              "Code-barres détecté. La matière a été renseignée manuellement.",
            modelSource: "barcode-detector",
            topPredictions: [],
          };
        } else {
          setDetecting(true);
          resultToSave = await analyzeCurrentPhoto();
          setDetecting(false);
        }
      }

      const detectedLabel = limitText(resultToSave.detectedObject || label || "Objet détecté", 140);
      const detectedMaterial = resultToSave.material || material || "autre";
      const detectedObject = limitText(resultToSave.detectedObject || detectedLabel, 140);
      const detectionStatus = limitText(resultToSave.detectionStatus || "", 60);
      const detectionReason = limitText(resultToSave.reason || "", 500);
      const detectedSortingClass =
        resultToSave.sortingClass ||
        (detectedMaterial === "recyclage_specialise"
          ? "recyclage_specialise"
          : resultToSave.recyclable
          ? "recyclable"
          : "non_recyclable");

      if (isUncertainDetection(resultToSave) && resultToSave.modelSource !== "user-correction") {
        setDetectionResult(resultToSave);
        setMaterial(detectedMaterial);
        setLabel(detectedObject);
        setError(
          "Le résultat est incertain. Corrigez la vraie classe avec « Ajouter au dataset et corriger » avant d'enregistrer."
        );
        return;
      }

      const formData = new FormData();
      formData.append("label", detectedLabel);
      formData.append("material", detectedMaterial);
      if (photo) {
        formData.append("photo", photo);
      }
      const isRecyclable =
        resultToSave?.recyclable ??
        (detectedMaterial !== "autre" &&
          [
            "recyclable",
            "recyclage_specialise",
            "plastique",
            "verre",
            "papier_carton",
            "metal",
            "electronique",
            "organique",
          ].includes(detectedMaterial));

      formData.append("recyclable", String(Boolean(isRecyclable)));
      formData.append("detectedObject", detectedObject);
      formData.append("confidence", String(resultToSave.confidence || 0));
      formData.append("detectionStatus", detectionStatus);
      formData.append("sortingClass", detectedSortingClass);
      formData.append("detectionReason", detectionReason);

      const data = await apiRequest("/scans", {
        method: "POST",
        token,
        body: formData,
      });

      if (data?.userPoints != null && user) {
        updateUser({ ...user, points: data.userPoints });
      }

      await loadHistory();
      setSuccess(data?.message || "Scan enregistré dans l'historique.");
      setLabel("");
      setPhoto(null);
      setPhotoPreview(null);
      setBarcodeResult(null);
      setDetectionResult(null);
      setNearbyCenters([]);
      setGeoMessage("");
    } catch (e2) {
      setDetecting(false);
      const message =
        e2?.message && e2.message !== "Une erreur est survenue"
          ? e2.message
          : "Le scan n'a pas pu être enregistré. Redémarrez l'API puis réessayez.";
      setError(message);
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
          <div>
            <div>
              <div className="badge">📷 Scan object</div>
              <h2 style={{ margin: "10px 0 6px" }}>Scanner un objet</h2>
              <div className="app-muted">
                Photographiez un objet : EcoScan reconnaît le type d&apos;objet (téléphone,
                télécommande, bouteille…) et la matière recyclable via l&apos;IA hybride.
                {modelLoading && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#ff9800" }}>
                    ⏳ Chargement du modèle IA (première utilisation)...
                  </div>
                )}
                {modelStatus && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {PYTHON_MOBILENET_FIRST_MODE
                      ? "✅ MobileNetV2 Python prioritaire (npm run ai)"
                      : modelLoading
                      ? "⏳ Chargement des modèles IA..."
                      : modelStatus.browserModelAvailable
                      ? "✅ Modèle déchets actif (navigateur)"
                      : modelStatus.pythonBackendAvailable
                      ? `✅ Service IA TensorFlow actif${modelStatus.labels ? ` (${modelStatus.labels} classes)` : ""}`
                      : modelStatus.pythonBackendUnavailable
                      ? "⚠️ Aucun modèle matière disponible — vérifiez public/models/waste-classifier ou lancez npm run ai"
                      : "ℹ️ Analyse hybride TensorFlow MobileNet + modèle déchets"}
                  </div>
                )}
              </div>
              <div className="app-muted" style={{ marginTop: 8 }}>
                Matériau: <b>{materialLabel}</b>
                {detectionResult && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ color: "#4caf50" }}>
                      ✓ Détecté: {detectionResult.detectedObject} ({detectionResult.confidence}%)
                    </div>
                    {detectionResult.recyclable !== undefined && (
                      <div style={{ marginTop: 4, fontWeight: 700, color: detectionResult.recyclable ? "#4caf50" : "#f44336" }}>
                        {formatRecyclingStatus(detectionResult)}
                      </div>
                    )}
                    {detectionResult.reason && (
                      <div style={{ marginTop: 4 }}>
                        {detectionResult.reason}
                      </div>
                    )}
                    {isUncertainDetection(detectionResult) && (
                      <div className="form-error" style={{ marginTop: 8 }}>
                        Résultat trop incertain pour être enregistré directement. Reprenez une photo
                        avec un seul objet bien cadré ou corrigez la classe ci-dessous.
                      </div>
                    )}
                    {detectionResult.allMobileNetTop && (
                      <div style={{ marginTop: 4, fontSize: 12, color: "#1565c0" }}>
                        Objet (MobileNet): {detectionResult.allMobileNetTop}
                      </div>
                    )}
                    {detectionResult.mobileNetObject && (
                      <div style={{ marginTop: 4, fontSize: 12, color: "#1565c0" }}>
                        Classe MobileNet retenue: {detectionResult.mobileNetObject}
                      </div>
                    )}
                    {Array.isArray(detectionResult.topPredictions) &&
                      detectionResult.topPredictions.length > 1 && (
                        <div style={{ marginTop: 4, fontSize: 12 }}>
                          Top matière (IA déchets):{" "}
                          {detectionResult.topPredictions
                            .map((item) => `${item.displayLabel || item.label} ${item.confidence}%`)
                            .join(" · ")}
                        </div>
                      )}
                    {photoPreview && detectionResult.modelSource !== "user-correction" && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          backgroundColor: "#fff8e1",
                          borderRadius: 8,
                          border: "1px solid #ffe082",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
                          Résultat incorrect ?
                        </div>
                        <p className="app-muted" style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.45 }}>
                          Choisissez la vraie classe. La photo sera enregistrée dans{" "}
                          <code>waste_dataset/</code> pour améliorer le modèle.
                        </p>
                        <label style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 4 }}>
                          Vraie classe
                        </label>
                        <select
                          className="app-input"
                          value={correctionClass}
                          onChange={(e) => setCorrectionClass(e.target.value)}
                          disabled={datasetSaving || loading}
                          style={{ width: "100%", marginBottom: 8 }}
                        >
                          {DATASET_CLASS_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="app-btn app-btn-primary"
                          onClick={handleAddToDataset}
                          disabled={datasetSaving || loading || detecting}
                        >
                          {datasetSaving ? "Enregistrement..." : "Ajouter au dataset et corriger"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {nearbyCenters.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, backgroundColor: "#e8f5e9", borderRadius: 8 }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: 14, color: "#1b8f4f" }}>
                    ♻️ Centres de recyclage proches
                  </h4>
                  <p className="app-muted" style={{ margin: 0, fontSize: 12 }}>
                    {geoMessage}
                  </p>
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    {nearbyCenters.slice(0, 3).map((c) => (
                      <div key={c.id} style={{ background: "#fff", padding: 8, borderRadius: 4, fontSize: 12 }}>
                        <div style={{ fontWeight: 700 }}>{c.centerName}</div>
                        <div className="app-muted">
                          {typeof c.distanceKm === "number" ? `≈ ${c.distanceKm} km • ` : ""}
                          {[c.city || "Tunisie", c.district].filter(Boolean).join(" · ")}
                        </div>
                        {(c.address || c.phone || c.openingHours) && (
                          <div className="app-muted" style={{ marginTop: 4 }}>
                            {[c.address, c.phone, c.openingHours].filter(Boolean).join(" • ")}
                          </div>
                        )}
                        <div className="app-muted" style={{ marginTop: 6 }}>
                          <b>Matériaux:</b> {formatCenterMaterials(c.materialsAccepted)}
                        </div>
                        <div className="app-muted" style={{ marginTop: 4 }}>
                          <b>Contact:</b> {[c.phone, c.email].filter(Boolean).join(" • ") || "Non précisé"}
                        </div>
                        {Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)) ? (
                          <div className="app-muted" style={{ marginTop: 4 }}>
                            <b>GPS:</b> {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                          </div>
                        ) : null}
                        {c.description ? (
                          <div className="app-muted" style={{ marginTop: 4 }}>
                            {c.description}
                          </div>
                        ) : null}
                        {String(c.id || "").startsWith("osm_") ||
                        String(c.id || "").startsWith("nominatim_") ? (
                          c.phone ? (
                            <a
                              className="app-btn app-btn-primary"
                              style={{ marginTop: 8, padding: "7px 10px", fontSize: 12, textDecoration: "none" }}
                              href={`tel:${c.phone}`}
                            >
                              Appeler le centre
                            </a>
                          ) : (
                            <div className="app-muted" style={{ marginTop: 8, fontSize: 12 }}>
                              Source Tunisie OpenStreetMap
                            </div>
                          )
                        ) : (
                          <button
                            type="button"
                            className="app-btn app-btn-primary"
                            style={{ marginTop: 8, padding: "7px 10px", fontSize: 12 }}
                            onClick={() => openMeetingRequest(c)}
                          >
                            Contacter / rendez-vous
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nearbyLoading && (
                <div style={{ marginTop: 12, padding: 8, backgroundColor: "#fff8e6", borderRadius: 8, fontSize: 12 }}>
                  ⏳ Recherche des centres proches...
                </div>
              )}

              {geoMessage && nearbyCenters.length === 0 && !nearbyLoading && (
                <div style={{ marginTop: 12, padding: 8, backgroundColor: "#fff8e6", borderRadius: 8, fontSize: 12 }}>
                  📍 {geoMessage}
                </div>
              )}
            </div>

            {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
            {success && <p className="form-info" style={{ marginTop: 12 }}>{success}</p>}

            <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
              {/* Photo : galerie ou webcam */}
              <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f9f9f9", borderRadius: 8 }}>
                <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 8 }}>
                  📸 Photo (optionnel)
                </label>
                <p className="app-muted" style={{ marginTop: 0, marginBottom: 10 }}>
                  Choisissez une image depuis la galerie ou utilisez l'aperçu caméra depuis le navigateur (HTTPS / localhost).
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
                {barcodeError ? <p className="form-error" style={{ marginTop: 10, marginBottom: 0 }}>{barcodeError}</p> : null}
                {cameraLive && (
                  <div style={{ position: "relative", width: "100%", maxHeight: 450, marginTop: 12, borderRadius: 8, overflow: "hidden", background: "#111" }}>
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      autoPlay
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                      }}
                    />
                    {barcodeScanning && (
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          width: "70%",
                          maxWidth: 420,
                          border: "3px solid #4caf50",
                          borderRadius: 12,
                          padding: 12,
                          color: "#fff",
                          textAlign: "center",
                          background: "rgba(0,0,0,0.25)",
                        }}
                      >
                        Placez le code-barres dans le cadre
                      </div>
                    )}
                  </div>
                )}

                {barcodeResult && (
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: "#e8f5e9", borderRadius: 8 }}>
                    <div style={{ fontWeight: 800, color: "#1b8f4f" }}>
                      Code-barres détecté : {barcodeResult.value}
                    </div>
                    <div className="app-muted" style={{ marginTop: 4, fontSize: 12 }}>
                      Format : {barcodeResult.format}. Sélectionnez la matière de l'emballage avant d'enregistrer.
                    </div>
                    <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginTop: 10, marginBottom: 6 }}>
                      Matière de l'emballage
                    </label>
                    <select
                      className="app-input"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      disabled={loading}
                      style={{ width: "100%" }}
                    >
                      {MATERIAL_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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

              <div className="app-row" style={{ marginTop: 12 }}>
                <button
                  className="app-btn app-btn-primary"
                  disabled={
                    loading ||
                    detecting ||
                    (!photoPreview && !barcodeResult) ||
                    (detectionResult &&
                      isUncertainDetection(detectionResult) &&
                      detectionResult.modelSource !== "user-correction")
                  }
                  type="submit"
                >
                  {loading
                    ? "Enregistrement..."
                    : barcodeResult
                    ? "Enregistrer le code-barres"
                    : detectionResult
                    ? "Enregistrer ce scan"
                    : "Analyser et enregistrer"}
                </button>
                <button className="app-btn" type="button" onClick={loadHistory} disabled={historyLoading}>
                  Rafraîchir
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="app-card" style={{ marginBottom: 16 }}>
          <div className="app-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div className="badge">🌱 Suivi d&apos;Impact</div>
              <h3 style={{ margin: "10px 0 6px" }}>Votre contribution environnementale</h3>
              <p className="app-muted" style={{ margin: 0 }}>
                Estimation basée sur vos scans recyclables enregistrés.
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1b8f4f" }}>
                {impactSummary.recyclableCount}
              </div>
              <div className="app-muted">déchets valorisés</div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <div style={{ padding: 12, borderRadius: 10, background: "#f0faf5" }}>
              <div className="app-muted" style={{ fontSize: 12 }}>Plastique réduit</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>
                {formatImpactNumber(impactSummary.plasticKg)} kg
              </div>
              <div className="app-muted" style={{ fontSize: 12 }}>
                ≈ {impactSummary.plasticCount} objet(s) plastique(s)
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "#f0faf5" }}>
              <div className="app-muted" style={{ fontSize: 12 }}>CO₂ évité estimé</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>
                {formatImpactNumber(impactSummary.co2Kg)} kg
              </div>
              <div className="app-muted" style={{ fontSize: 12 }}>grâce au tri orienté</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "#f0faf5" }}>
              <div className="app-muted" style={{ fontSize: 12 }}>Points écologiques</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{impactSummary.points}</div>
              <div className="app-muted" style={{ fontSize: 12 }}>sur vos scans recyclables</div>
            </div>
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
                  <div key={scan.id} style={{ display: "grid", gap: 8 }}>
                    <button
                      type="button"
                      className="app-btn"
                      style={{ textAlign: "left" }}
                      onClick={() => navigate(`/scan/${scan.id}`)}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <div>
                          <b>{scan.label}</b> — {formatRecyclingStatus(scan)}
                        </div>
                        <div className="app-muted">
                          Matériau: <b>{getMaterialLabel(scan.material)}</b>
                          {scan.detectedObject ? ` • IA: ${scan.detectedObject}` : ""}
                          {scan.confidence ? ` (${scan.confidence}%)` : ""}
                        </div>
                        <div className="app-muted">
                          {scan.createdAt ? `Date: ${formatDateFr(scan.createdAt)} • ` : ""}
                          Points: +{scan.points || 0}
                        </div>
                      </div>
                    </button>
                    <div className="app-row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="app-btn"
                        style={{ fontSize: 12, padding: "4px 8px" }}
                        onClick={() => handleDeleteScan(scan.id, scan.points)}
                      >
                        🗑️ Supprimer
                      </button>
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

