# ✅ Checklist Maintenance - Architecture MVC

## 🔍 Avant de merger du code

### Code Review Checklist

- [ ] **Controller**
  - [ ] La logique métier est isolée du contrôleur de route
  - [ ] Les erreurs sont capturées avec try-catch
  - [ ] Les réponses HTTP utilisent les bons codes (200, 201, 400, 401, 403, 404, 500)
  - [ ] Les données sensibles ne sont pas loggées
  - [ ] Pas de code dupliqué (voir les helpers)

- [ ] **Routes**
  - [ ] Les routes appellent correctement le controller
  - [ ] Les middleware sont appliqués (auth, upload, validation)
  - [ ] Les noms de routes sont cohérents avec les conventions REST
  - [ ] La documentation des routes est à jour

- [ ] **Models**
  - [ ] Les schémas Mongoose sont corrects
  - [ ] Les validations Mongoose sont en place
  - [ ] Les index sont créés si nécessaire (pour les requêtes fréquentes)
  - [ ] Les relations entre modèles sont claires

- [ ] **Utilitaires**
  - [ ] Les helpers sont réutilisables (pas spécifiques à un cas)
  - [ ] Les constantes ne se chevauchent pas
  - [ ] Les noms des fonctions sont clairs et cohérents

### Git Commit Checklist

```bash
# ✅ Bon commit
git commit -m "feat: add user stats endpoint (/api/users/stats)"
git commit -m "refactor: extract post validation to helper"
git commit -m "fix: handle missing MongoDB connection in centers controller"

# ❌ Mauvais commit
git commit -m "fix stuff"
git commit -m "changes"
git commit -m "wip: random changes"
```

---

## 📝 Standard de Code

### Nommage des Contrôleurs

```javascript
// ✅ Bon - verbes clairs et cohérents
class UserController {
  static async getProfile() {}
  static async updateProfile() {}
  static async getStats() {}
}

// ❌ Mauvais - noms incohérents
class UserController {
  static async fetchUser() {}        // Mix fetch/get
  static async modifyProfile() {}    // Utiliser update
  static async calculateStats() {}   // Trop spécifique
}
```

### Nommage des Routes

```javascript
// ✅ REST conventions
GET    /api/users              // Lister
GET    /api/users/:id          // Récupérer un
POST   /api/users              // Créer
PATCH  /api/users/:id          // Mettre à jour
DELETE /api/users/:id          // Supprimer

// ❌ Non-REST
GET    /api/getUser
POST   /api/createUser
PUT    /api/updateUser
GET    /api/deleteUser
```

### Gestion des Erreurs

```javascript
// ✅ Bonne pratique
static async updateProfile(req, res) {
  try {
    const { firstName } = req.body;
    
    // Validation
    if (!firstName?.trim()) {
      return res.status(400).json({ message: "Prénom invalide" });
    }
    
    // Requête DB
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName },
      { new: true }
    );
    
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ message: error.message });
  }
}

// ❌ Mauvaise pratique
static async updateProfile(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    req.body  // Aucune validation!
  );
  res.json(user);  // Pas de try-catch
}
```

---

## 🐛 Debugging

### Logs Recommandés

```javascript
// Dans les controllers importants
console.log("User login attempt:", email);
console.log("Forum post created:", postId);
console.log("Error in scan creation:", error.message);

// Pas trop verbeux - éviter les logs pour chaque opération
console.log("User ID:", req.user._id);  // ❌ Trop verbose
```

### Vérifier la connexion MongoDB

```bash
# Dans une requête HTTP
GET /api/health

# Réponse
{ "status": "ok" }

# Ou vérifier directement
node -e "require('mongoose').connect('mongodb://127.0.0.1:27017/ecoscan').then(() => console.log('✅ Connected'))"
```

---

## 🔐 Sécurité

### Checklist de Sécurité

- [ ] **Authentification**
  - [ ] JWT tokens expiration configurée
  - [ ] Refresh tokens revoqués correctement
  - [ ] Passwords hashés avec bcrypt
  - [ ] Session invalidée à la déconnexion

- [ ] **Autorisation**
  - [ ] Les resources sont vérifiées par user ID
  - [ ] Les admins ont accès aux routes admin
  - [ ] Les utilisateurs ne peuvent modifier que leurs propres données

- [ ] **Validation**
  - [ ] Les inputs sont trimés et validés
  - [ ] Les types sont vérifiés (string, number, etc.)
  - [ ] Les arrays sont vérifiés avant d'être itérés

- [ ] **Données Sensibles**
  - [ ] Passwords ne sont jamais retournés
  - [ ] Tokens ne sont pas loggés
  - [ ] Email privés filtrés avant envoi

---

## 📊 Performance

### Optimisations à Considérer

```javascript
// ❌ Inefficace - N+1 queries
const posts = await Post.find().lean();
for (const post of posts) {
  const author = await User.findById(post.authorId);  // Une requête par post!
}

// ✅ Optimisé - Batch query
const posts = await Post.find().lean();
const authorIds = [...new Set(posts.map(p => p.authorId.toString()))];
const authors = await User.find({ _id: { $in: authorIds } }).lean();
const authorById = new Map(authors.map(u => [u._id.toString(), u]));
```

### Index MongoDB

```javascript
// Dans les modèles - ajouter des indexes pour les requêtes fréquentes
const userSchema = new Schema({
  email: { type: String, unique: true, index: true },  // ✅ Indexé
  createdAt: { type: Date, default: Date.now, index: true }
});

// Vérifier les indexes
db.users.getIndexes()
```

---

## 📚 Documentation à Maintenir

- [ ] **MVC-ARCHITECTURE.md** - À jour avec les nouvelles features
- [ ] **GUIDE-AJOUTER-FONCTIONNALITE.md** - Valide pour les nouvelles features
- [ ] **API Documentation** - Endpoints documentés (Swagger, OpenAPI, etc.)
- [ ] **Comments dans le code** - Explications des logiques complexes

---

## 🔄 Processus de Déploiement

### Avant le déploiement

```bash
# 1. Vérifier les tests
npm test

# 2. Linter
npm run lint

# 3. Build
npm run build

# 4. Vérifier les dépendances
npm audit

# 5. Vérifier les variables d'env
cat .env.production

# 6. Migration DB (si nécessaire)
npm run migrate
```

### Après le déploiement

```bash
# 1. Tester les endpoints principaux
curl https://api.example.com/api/health

# 2. Vérifier les logs
tail -f logs/error.log

# 3. Monitorer les métriques
# - Uptime
# - Response time
# - Error rate
```

---

## 🎯 Objectifs de Qualité

| Métrique | Target | Current |
|----------|--------|---------|
| Test coverage | 80%+ | TBD |
| Code complexity | Faible | TBD |
| Average response time | < 200ms | TBD |
| Error rate | < 0.1% | TBD |
| Uptime | 99.9%+ | TBD |

---

## 📞 Points de Contact

- Architecture questions → Lead Backend
- Database issues → DBA
- Security concerns → Security team
- Performance issues → DevOps

---

**Dernière mise à jour:** 2026-05-14
