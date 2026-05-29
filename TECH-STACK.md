# 🛠️ Stack Technologique - EcoScan Recycle

## 📋 Vue d'Ensemble

EcoScan Recycle utilise une architecture **moderne et scalable** reposant sur les technologies web les plus fiables du marché:

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React.js)                       │
│  - Détection d'objets avec TensorFlow.js (COCO-SSD)        │
│  - Cartographie avec OpenStreetMap + Leaflet              │
│  - Authentification JWT (Context API)                      │
│  - État local avec Hooks React                            │
└─────────────────────────────────────────────────────────────┘
                          ↓ API REST
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js/Express)                  │
│  - Authentification JWT + Refresh Tokens                   │
│  - Architecture MVC (Models, Controllers, Routes)          │
│  - Gestion des fichiers (Multer)                          │
│  - Database: MongoDB                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend - React.js

### Stack Principal
- **React 19.2.4** - Framework UI moderne
- **React Router 6.30** - Navigation côté client
- **React Leaflet 5.0** - Intégration Leaflet
- **TensorFlow.js 3.21** - IA côté client
- **COCO-SSD 2.2.3** - Détection d'objets

### Fonctionnalités Clés

#### 1️⃣ Scan Intelligent (TensorFlow.js)

```javascript
// src/Scan.js
import { detectObjects, suggestMaterial, loadModel } from "./utils/tensorflowUtils";

// Chargement du modèle
useEffect(() => {
  loadModel().catch(err => console.error("Erreur modèle:", err));
}, []);

// Détection automatique du matériau
const handlePhotoCapture = async (file) => {
  const { detections, suggestedMaterial } = await processImageFile(file);
  setMaterial(suggestedMaterial); // Auto-fill du matériau
};
```

**Processus:**
1. Capture photo (camera ou file)
2. TensorFlow.js détecte l'objet
3. Suggère le matériau automatiquement
4. Utilisateur peut modifier
5. Envoi au backend

#### 2️⃣ Cartographie (OpenStreetMap + Leaflet)

```javascript
// src/components/RecyclingCenterMap.js
import { MapContainer, TileLayer, Marker } from "react-leaflet";

<MapContainer center={mapCenter} zoom={12}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {centers.map(center => (
    <Marker position={[center.latitude, center.longitude]}>
      <Popup>{center.centerName}</Popup>
    </Marker>
  ))}
</MapContainer>
```

**Fonctionnalités:**
- Affichage des centres en temps réel
- Calcul de distance (Haversine)
- Filtrage par matériau
- Clustering automatique

#### 3️⃣ Authentification (JWT)

```javascript
// src/context/AuthContext.js
const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(getStoredUser());

  const login = async (email, password) => {
    const { token, user } = await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password }
    });
    saveSession(token, user);
  };
};
```

---

## ⚙️ Backend - Node.js / Express.js

### Stack Principal
- **Node.js 20** - Runtime JavaScript
- **Express.js 5.2** - Framework web
- **MongoDB 8.23** - Base de données
- **Mongoose 8.23** - ODM/Validation
- **JWT (jsonwebtoken 9.0)** - Authentification
- **bcryptjs 3.0** - Hachage passwords

### Architecture MVC

```
backend/api/
├── controllers/         → Logique métier
│   ├── authController.js
│   ├── scanController.js
│   ├── forumController.js
│   └── centerController.js
├── routes/             → Points d'entrée HTTP
│   ├── authRoutes.js
│   ├── scanRoutes.js
│   └── forumRoutes.js
├── models/             → Schemas Mongoose
│   ├── User.js
│   ├── Scan.js
│   ├── Post.js
│   └── RecyclingCenter.js
└── middleware/         → Auth + Validation
    └── auth.js
```

### Fonctionnalités Clés

#### 1️⃣ Authentification JWT

```javascript
// utils/tokenManager.js
class TokenManager {
  createAccessToken(user) {
    return jwt.sign(
      { sub: user._id, role: user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
  }

  createRefreshToken(userId, tokenId) {
    return jwt.sign(
      { sub: userId, jti: tokenId, type: "refresh" },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );
  }
}
```

**Flux:**
- Access Token (15 min) + Refresh Token (7 jours)
- Stockage secure en cookie httpOnly
- Revocation automatique à la déconnexion
- Rotation des tokens à chaque refresh

#### 2️⃣ Gestion des Scans

```javascript
// controllers/scanController.js
class ScanController {
  static async createScan(req, res) {
    // Validation
    if (!label || !material) {
      return res.status(400).json({ message: "Champs requis" });
    }

    // Lookup base de données
    const materialData = MATERIAL_DATABASE[material];
    
    // Créer le scan
    const scan = await Scan.create({
      userId: req.user._id,
      label,
      material,
      points: materialData.points,
      photoUrl: req.file?.filename
    });

    // Incrémenter points utilisateur
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { points: materialData.points } }
    );

    return res.status(201).json({ scan });
  }
}
```

#### 3️⃣ Upload de Fichiers (Multer)

```javascript
// server.js
const scanUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `scan_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format invalide"));
    }
  }
});

app.post("/api/scans", authMiddleware, scanUpload.single("photo"), 
  ScanController.createScan);
```

---

## 🗄️ Base de Données - MongoDB

### Collections Principales

```javascript
// Users Collection
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  email: String (unique),
  passwordHash: String,
  role: "client" | "admin" | "moderator",
  accountType: "collecteur" | "centre_de_collecte",
  points: Number,
  createdAt: Date
}

// Scans Collection
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  label: String,
  material: "plastique" | "verre" | "papier_carton" | "metal" | "electronique" | "organique",
  recyclable: Boolean,
  points: Number,
  photoUrl: String,
  createdAt: Date
}

// Posts Collection (Forum)
{
  _id: ObjectId,
  authorId: ObjectId (ref: User),
  title: String,
  content: String,
  tags: [String],
  images: [{ url, filename, mimeType, size }],
  status: "published" | "hidden" | "deleted",
  createdAt: Date,
  updatedAt: Date
}

// RecyclingCenters Collection
{
  _id: ObjectId,
  centerName: String,
  city: String,
  latitude: Number,
  longitude: Number,
  materialsAccepted: [String],
  phone: String,
  openingHours: String,
  rating: Number,
  totalReviews: Number,
  isVerified: Boolean,
  createdAt: Date
}
```

### Indexes (Performance)

```javascript
// Models
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });

db.scans.createIndex({ userId: 1, createdAt: -1 });
db.scans.createIndex({ material: 1 });

db.posts.createIndex({ authorId: 1, createdAt: -1 });
db.posts.createIndex({ status: 1 });

db.recyclingcenters.createIndex({ latitude: 1, longitude: 1 });
db.recyclingcenters.createIndex({ city: 1 });
```

---

## 🔐 Authentification et Sécurité

### JWT Flow

```
1. User → POST /api/auth/login { email, password }
                    ↓
2. Backend → Valide credentials → Hash password avec bcrypt
                    ↓
3. Backend → Génère tokens:
   - Access Token (15 min) → JWT signé
   - Refresh Token (7 jours) → Cookie httpOnly
                    ↓
4. Frontend → Stocke Access Token en localStorage
            → Cookie Refresh Token automatique
                    ↓
5. Requests → Header: Authorization: Bearer <accessToken>
                    ↓
6. Middleware → Valide JWT avec ACCESS_TOKEN_SECRET
```

### Sécurité

| Aspect | Implémentation |
|--------|-----------------|
| Passwords | Hachés bcryptjs (12 rounds) |
| Tokens | JWT signés avec secrets sécurisés |
| Refresh Tokens | Cookies httpOnly + secure |
| CORS | Configuré par domaine |
| Rate Limiting | À implémenter (express-rate-limit) |
| SQL Injection | N/A (MongoDB + Mongoose) |
| XSS | React échappe automatiquement |

---

## 🗺️ Cartographie - OpenStreetMap + Leaflet

### Intégration

```javascript
// RecyclingCenterMap.js
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Tile Layer (OpenStreetMap)
<TileLayer 
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution='© OpenStreetMap contributors'
/>

// Markers personnalisés
const recyclingIcon = new L.Icon({
  iconUrl: "marker-icon-green.png",
  iconSize: [25, 41],
});

<Marker position={[lat, lng]} icon={recyclingIcon}>
  <Popup>{centerName}</Popup>
</Marker>
```

### Calcul de Distance

```javascript
// utils/helpers.js - Formule Haversine
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Rayon terrestre en km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
```

---

## 🤖 TensorFlow.js - IA

### Modèle COCO-SSD

```javascript
// utils/tensorflowUtils.js
import * as coco from "@tensorflow-models/coco-ssd";

// Charger le modèle
const model = await coco.load();

// Détecter les objets
const predictions = await model.detect(imageElement);
// Output: [
//   { class: "bottle", score: 0.95, bbox: [x, y, w, h] },
//   { class: "cup", score: 0.87, bbox: [x, y, w, h] }
// ]

// Suggérer matériau
const suggestMaterial = (detections) => {
  const objectLabel = detections[0].class.toLowerCase();
  
  if (objectLabel.includes("bottle")) return "plastique";
  if (objectLabel.includes("glass")) return "verre";
  if (objectLabel.includes("can")) return "metal";
  
  return null;
};
```

### Performances

- ⚡ **Temps d'inférence:** ~50-100ms (GPU) / ~200-400ms (CPU)
- 📱 **Mémoire:** ~30-50MB (modèle compressé)
- 🎯 **Accuracy:** 90-95% sur objets courants
- ✅ **Avantage:** Aucun upload serveur, traitement client

---

## 📡 Communication

### API REST

```
GET    /api/health                    → Vérifier serveur
POST   /api/auth/register             → Inscription
POST   /api/auth/login                → Connexion
POST   /api/auth/refresh              → Rafraîchir token
POST   /api/scans                     → Créer un scan
GET    /api/scans/my                  → Mes scans
GET    /api/centers                   → Lister centres
GET    /api/centers/nearby            → Centres proches
GET    /api/forum/posts               → Lister posts
POST   /api/forum/posts               → Créer post
```

### WebRTC (Futur)

Préparation pour communication temps réel:
```javascript
// À implémenter: Chat, notifications, streaming vidéo
import SimplePeer from "simple-peer";

const peer = new SimplePeer({ initiator: true, trickleIce: false });
peer.on("signal", data => sendToServer(data));
peer.on("stream", stream => videoElement.srcObject = stream);
```

---

## 📊 Performance et Scalabilité

| Composant | Optimisation |
|-----------|-------------|
| Frontend | Lazy loading, code splitting, caching |
| Backend | Indexation MongoDB, pagination, compression gzip |
| Images | Compression Multer, stockage externe |
| API | Rate limiting, caching Redis (futur) |
| IA | Model caching, batch processing |

---

## 🚀 Infrastructure

### Développement Local
```bash
Frontend:  http://localhost:3000 (React)
Backend:   http://localhost:4000 (Node.js)
Database:  mongodb://127.0.0.1:27017 (MongoDB)
```

### Production (Recommandé)
- **Frontend:** Netlify / Vercel
- **Backend:** Heroku / Railway / AWS EC2
- **Database:** MongoDB Atlas
- **Storage:** AWS S3 / Cloudinary
- **CDN:** Cloudflare

---

## 📚 Dépendances Clés

### Frontend
```json
{
  "react": "19.2.4",
  "react-router-dom": "6.30.1",
  "leaflet": "1.9.4",
  "react-leaflet": "5.0.0",
  "@tensorflow/tfjs": "3.21.0",
  "@tensorflow-models/coco-ssd": "2.2.3",
  "axios": "1.6.0"
}
```

### Backend
```json
{
  "express": "5.2.1",
  "mongoose": "8.23.0",
  "jsonwebtoken": "9.0.3",
  "bcryptjs": "3.0.3",
  "multer": "2.0.2",
  "cors": "2.8.6",
  "dotenv": "17.4.2"
}
```

---

**Stack technologique moderne et fiable pour EcoScan Recycle! 🚀**
