# 🚀 Guide : Ajouter une nouvelle fonctionnalité

Ce guide explique comment ajouter une nouvelle fonctionnalité au backend EcoScan avec l'architecture MVC refactorisée.

## 📖 Exemple : Ajouter un endpoint "Mes statistiques utilisateur"

Nous allons créer une route `GET /api/users/stats` qui retourne les statistiques d'un utilisateur.

### Étape 1: Ajouter la méthode au Controller

Fichier: `controllers/userController.js`

```javascript
class UserController {
  // ... autres méthodes ...

  // ✅ Ajouter cette nouvelle méthode
  static async getStats(req, res) {
    try {
      // Requête base de données
      const scanCount = await Scan.countDocuments({ userId: req.user._id });
      const posts = await Post.countDocuments({ authorId: req.user._id });
      
      const stats = {
        scans: scanCount,
        posts,
        points: req.user.points || 0,
        level: req.user.points < 100 ? "Débutant" : "Contributeur",
      };

      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
}

module.exports = UserController;
```

### Étape 2: Ajouter la route

Fichier: `routes/userRoutes.js`

```javascript
const createUserRoutes = () => {
  const router = express.Router();

  router.patch("/me", (req, res) => UserController.updateProfile(req, res));
  router.get("/me", (req, res) => UserController.getProfile(req, res));

  // ✅ Ajouter cette route
  router.get("/stats", (req, res) => UserController.getStats(req, res));

  router.post("/logout-all", (req, res) => {
    // ... code ...
  });

  return router;
};

module.exports = createUserRoutes;
```

### Étape 3: C'est tout ! 🎉

L'endpoint est maintenant disponible à:
```
GET /api/users/stats
```

**Requête:**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/users/stats
```

**Réponse:**
```json
{
  "scans": 15,
  "posts": 3,
  "points": 145,
  "level": "Contributeur"
}
```

---

## 📋 Checklist : Ajouter une nouvelle fonctionnalité complète

Pour une fonctionnalité plus complexe (ex: "Ajouter un système de badges"), suivez ce checklist:

### ✅ 1. Model (si nécessaire)
- [ ] Créer/modifier le modèle Mongoose dans `models/`
- [ ] Ajouter les champs nécessaires
- [ ] Ajouter les validations

```javascript
// models/Badge.js
const badgeSchema = new mongoose.Schema({
  name: String,
  description: String,
  icon: String,
  // ...
});
```

### ✅ 2. Constants (si nécessaire)
- [ ] Ajouter les constantes à `utils/constants.js`

```javascript
// utils/constants.js
const BADGE_TYPES = ["eco_warrior", "scanner_pro", "forum_hero"];
```

### ✅ 3. Helpers (si réutilisable)
- [ ] Ajouter les fonctions utilitaires à `utils/helpers.js`

```javascript
// utils/helpers.js
const calculateBadges = (user) => {
  // Logique pour calculer les badges
  return badges;
};
```

### ✅ 4. Controller
- [ ] Créer `controllers/badgeController.js` OU ajouter les méthodes au controller existant
- [ ] Implémenter chaque action (GET, POST, PUT, DELETE)

```javascript
class BadgeController {
  static async getBadges(req, res) { }
  static async awardBadge(req, res) { }
}
```

### ✅ 5. Routes
- [ ] Créer `routes/badgeRoutes.js` OU ajouter les routes au fichier existant
- [ ] Enregistrer chaque route avec le bon HTTP verb

```javascript
router.get("/", (req, res) => BadgeController.getBadges(req, res));
router.post("/:userId", (req, res) => BadgeController.awardBadge(req, res));
```

### ✅ 6. Server.js
- [ ] Importer les routes
- [ ] Enregistrer les routes au bon chemin

```javascript
const badgeRoutes = createBadgeRoutes();
app.use("/api/badges", authMiddleware, badgeRoutes);
```

### ✅ 7. Test
- [ ] Tester avec Postman/curl
- [ ] Vérifier les cas d'erreur

```bash
curl -X POST http://localhost:4000/api/badges/userid \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"badgeType": "eco_warrior"}'
```

---

## 🎯 Bonnes pratiques

### 1. **Garder les controllers légers**
```javascript
// ❌ Mauvais: Logique complexe dans le controller
static async createPost(req, res) {
  // 100 lignes de code mélangé...
}

// ✅ Bon: Déléguer la logique aux helpers
static async createPost(req, res) {
  const post = await validateAndCreatePost(req.body);
  return res.json(post);
}
```

### 2. **Utiliser les constantes**
```javascript
// ❌ Mauvais: Valeurs en dur
if (req.body.material === "plastique") { }

// ✅ Bon: Utiliser les constantes
if (ALLOWED_MATERIALS.includes(req.body.material)) { }
```

### 3. **Centraliser la validation**
```javascript
// ✅ Créer une fonction réutilisable
const validatePostData = (data) => {
  if (!data.title) throw new Error("Titre requis");
  if (!data.content) throw new Error("Contenu requis");
  return data;
};
```

### 4. **Noms cohérents**
```javascript
// ✅ Noms clairs et cohérents
createPost()  // ✅
getPost()     // ✅
updatePost()  // ✅
deletePost()  // ✅

createPost()  // ❌ makePost (incohérent)
fetchPost()   // ❌ getPost (mieux)
modifyPost()  // ❌ updatePost (mieux)
removePost()  // ❌ deletePost (mieux)
```

---

## 🔗 Ressources

- [Architecture MVC complète](MVC-ARCHITECTURE.md)
- [Controllers](controllers/)
- [Routes](routes/)
- [Utils](utils/)
