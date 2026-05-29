# 🏗️ Architecture MVC Refactorisée - Backend EcoScan

## Vue d'ensemble

Le backend EcoScan a été **refactorisé de zéro** pour suivre une architecture **MVC (Model-View-Controller)** propre et maintenable. Auparavant, toute la logique métier était mélangée dans [server.js](server.js). Maintenant, le code est organisé en couches bien définies.

## 📂 Structure des dossiers

```
backend/api/
├── server.js                  # Point d'entrée (configuration + routage)
├── models/                    # Models (Mongoose schemas)
│   ├── User.js
│   ├── Post.js
│   ├── Comment.js
│   ├── Scan.js
│   ├── MeetingRequest.js
│   └── RecyclingCenter.js
├── controllers/               # Controllers (logique métier)
│   ├── authController.js
│   ├── userController.js
│   ├── forumController.js
│   ├── centerController.js
│   ├── scanController.js
│   └── meetingController.js
├── routes/                    # Routes (endpoints)
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── forumRoutes.js
│   ├── centerRoutes.js
│   ├── scanRoutes.js
│   └── meetingRoutes.js
├── middleware/                # Middleware (authentification, validation)
│   └── auth.js
└── utils/                     # Utilitaires (helpers, constants)
    ├── constants.js
    ├── helpers.js
    ├── tokenManager.js
    └── osm.js
```

## 🔄 Flux de données (MVC)

### 1. **Models** (Données)

Les models Mongoose définissent la structure des données en base de données.

```javascript
// models/User.js
const userSchema = new mongoose.Schema({
  firstName: String,
  email: { type: String, unique: true },
  passwordHash: String,
  // ...
});
```

### 2. **Routes** (Points d'entrée)

Les routes reçoivent les requêtes HTTP et les acheminent vers les controllers.

```javascript
// routes/userRoutes.js
router.patch("/me", (req, res) => UserController.updateProfile(req, res));
router.get("/me", (req, res) => UserController.getProfile(req, res));
```

### 3. **Controllers** (Logique métier)

Les controllers contiennent toute la logique métier : validation, requêtes DB, formatage des données.

```javascript
// controllers/userController.js
class UserController {
  static async updateProfile(req, res) {
    const { firstName, lastName } = req.body;
    // Validation
    if (!firstName) return res.status(400).json({ message: "Prénom requis" });

    // Requête DB
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName },
      { new: true },
    );

    // Réponse
    return res.json({ user: sanitizeUser(user) });
  }
}
```

### 4. **Server** (Configuration)

Le server configure l'app, les middleware et enregistre les routes.

```javascript
// server.js
const userRoutes = createUserRoutes();
app.use("/api/users", authMiddleware, userRoutes);
```

## 📋 Organisation par fonctionnalité

### Authentication

- **Controller**: [authController.js](controllers/authController.js)
  - `register()` - Inscription utilisateur
  - `login()` - Connexion
  - `refresh()` - Rafraîchir le token
  - `logout()` - Déconnexion
- **Route**: [authRoutes.js](routes/authRoutes.js)
- **Model**: [User.js](models/User.js)

### Users

- **Controller**: [userController.js](controllers/userController.js)
  - `updateProfile()` - Modifier le profil
  - `getProfile()` - Récupérer le profil
- **Route**: [userRoutes.js](routes/userRoutes.js)
- **Model**: [User.js](models/User.js)

### Forum

- **Controller**: [forumController.js](controllers/forumController.js)
  - `getPosts()` - Lister les posts
  - `createPost()` - Créer un post
  - `getPost()` - Récupérer un post
  - `updatePost()` - Modifier un post
  - `deletePost()` - Supprimer un post
  - `createComment()` - Ajouter un commentaire
  - `updateComment()` - Modifier un commentaire
  - `deleteComment()` - Supprimer un commentaire
- **Route**: [forumRoutes.js](routes/forumRoutes.js)
- **Models**: [Post.js](models/Post.js), [Comment.js](models/Comment.js)

### Recycling Centers

- **Controller**: [centerController.js](controllers/centerController.js)
  - `getCenters()` - Lister les centres
  - `getNearby()` - Centres à proximité (géolocalisation)
  - `getOSMCenters()` - Données OpenStreetMap
- **Route**: [centerRoutes.js](routes/centerRoutes.js)
- **Model**: [RecyclingCenter.js](models/RecyclingCenter.js)

### Scans

- **Controller**: [scanController.js](controllers/scanController.js)
  - `createScan()` - Créer un scan
  - `getScan()` - Récupérer un scan
  - `getMyScans()` - Lister mes scans
- **Route**: [scanRoutes.js](routes/scanRoutes.js)
- **Model**: [Scan.js](models/Scan.js)

### Meetings

- **Controller**: [meetingController.js](controllers/meetingController.js)
  - `createMeeting()` - Créer une demande de réunion
  - `getMyMeetings()` - Mes demandes
  - `getInbox()` - Boîte de réception
- **Route**: [meetingRoutes.js](routes/meetingRoutes.js)
- **Model**: [MeetingRequest.js](models/MeetingRequest.js)

## 🔐 Middleware

### [auth.js](middleware/auth.js)

- `createAuthMiddleware(tokenManager)` - Authentification JWT
- `requireDatabase` - Vérifier la connexion MongoDB

```javascript
// Utilisation
app.use("/api/users", authMiddleware, userRoutes);
```

## 🛠️ Utilitaires

### [constants.js](utils/constants.js)

Constantes et configurations (matériaux acceptés, types de centres, etc.)

### [helpers.js](utils/helpers.js)

Fonctions utilitaires :

- `sanitizeUser()` - Nettoyer les données utilisateur
- `haversineKm()` - Calculer la distance entre 2 points GPS
- `forumCanReply()` - Vérifier les permissions

### [tokenManager.js](utils/tokenManager.js)

Gestion des JWT :

- `createAccessToken()` - Générer un token d'accès
- `verifyAccessToken()` - Valider un token
- `issueTokensForUser()` - Émettre access + refresh tokens

### [osm.js](utils/osm.js)

Intégration OpenStreetMap/Overpass API :

- `runOverpassQuery()` - Requêtes vers OpenStreetMap

## 🚀 Exemple : Ajouter une nouvelle fonctionnalité

Supposons qu'on veuille ajouter une route `GET /api/users/stats` pour récupérer les stats d'un utilisateur.

### 1. Ajouter la méthode dans le controller

```javascript
// controllers/userController.js
static async getStats(req, res) {
  try {
    const scans = await Scan.countDocuments({ userId: req.user._id });
    const points = req.user.points || 0;

    return res.json({ scans, points });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
```

### 2. Ajouter la route

```javascript
// routes/userRoutes.js
router.get("/stats", (req, res) => UserController.getStats(req, res));
```

### 3. C'est tout ! 🎉

La route est maintenant disponible à `GET /api/users/stats`

## ✅ Avantages de cette architecture

| Aspect              | Avant                             | Après                                        |
| ------------------- | --------------------------------- | -------------------------------------------- |
| **Maintenabilité**  | Code mélangé dans server.js       | Code organisé par fonctionnalité             |
| **Testabilité**     | Difficile à tester                | Chaque controller peut être testé isolément  |
| **Réutilisabilité** | Logique répétée                   | Logique centralisée dans helpers             |
| **Scalabilité**     | Ajout de nouvelles routes = chaos | Ajout de nouvelles routes = simple et rapide |
| **Clarté**          | 2000+ lignes dans server.js       | Chaque fichier = responsabilité unique       |

## 📚 Pour aller plus loin

- [Lire le server.js refactorisé](server.js)
- [Explorer les controllers](controllers/)
- [Comprendre le TokenManager](utils/tokenManager.js)
