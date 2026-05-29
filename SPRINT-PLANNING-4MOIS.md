# 🎯 Sprint Planning EcoScan Recycle - 4 Mois (5 Sprints)

> Plan détaillé pour développer le MVP complet en 4 mois avec 5 sprints condensés

---

## 📊 Vue d'Ensemble

```
════════════════════════════════════════════════════════════════════════════════
  4 MOIS = 16 SEMAINES = 5 SPRINTS (3-4 SEMAINES CHACUN)
════════════════════════════════════════════════════════════════════════════════

      MOIS 1          |       MOIS 2       |       MOIS 3        |    MOIS 4
      ───────────────|───────────────────|───────────────────|──────────────
  Sprint 1 (3 sem)   |   Sprint 2 (3 sem)|   Sprint 3 (3 sem)|Sprint 4 + 5
                                                                 (2.5+4 sem)
```

| Sprint | Durée | Focus | Statut |
|--------|-------|-------|--------|
| 1 | 3 sem | 🔐 Fondations + Auth + Profils | 🔴 À faire |
| 2 | 3 sem | 📸 Scanning + Upload + Points | 🔴 À faire |
| 3 | 3 sem | 💬 Forum + Comments + Leaderboard | 🔴 À faire |
| 4 | 2.5 sem | 🗺️ Géolocalisation + Meetings | 🔴 À faire |
| 5 | 4 sem | 🚀 Testing + Deployment + Polish | 🔴 À faire |

---

## 🔐 SPRINT 1: Fondations + Auth + Profils (3 Semaines)

**Objectif:** Infrastructure backend, authentification et gestion utilisateur complète

### 📋 User Stories

#### US1.1: Infrastructure & Auth
```
Setup Express server + MongoDB + JWT authentication

CRITÈRES D'ACCEPTATION:
✅ Express démarre sur port 4000
✅ MongoDB connecté
✅ POST /api/auth/register crée utilisateur
✅ POST /api/auth/login retourne tokens JWT
✅ Tokens: access (15min) + refresh (7 jours)
✅ Passwords hachés (bcryptjs 12 rounds)
```

#### US1.2: Profils Utilisateur
```
Profil utilisateur avec modèles de données complets

CRITÈRES D'ACCEPTATION:
✅ GET /api/users/me retourne profil
✅ PATCH /api/users/me modifie info (firstName, lastName, phone, avatar)
✅ User.role (user, moderator, admin)
✅ User.points pour scoring
✅ Avatar upload optionnel
```

#### US1.3: Modèles de Données
```
Tous les schemas MongoDB pour le MVP

CRITÈRES D'ACCEPTATION:
✅ User.js (email, password, firstName, points, role, avatar)
✅ Scan.js (userId, label, material, points, photoUrl)
✅ Post.js (authorId, title, content, images[], status)
✅ Comment.js (postId, authorId, content)
✅ RecyclingCenter.js (name, location, materials[], phone, website)
✅ MeetingRequest.js (userId, centerId, status, datePreference)
✅ Tous les indexes créés
```

### 📦 Livrables

**Backend:**
- [x] Express server setup
- [x] MongoDB connection
- [x] TokenManager class
- [x] authController (register, login, refresh, logout)
- [x] userController (getProfile, updateProfile)
- [x] authMiddleware
- [x] authRoutes + userRoutes
- [x] Tous les 6 models Mongoose
- [x] Multer setup (avatars)
- [x] Error middleware

**Frontend:**
- [x] React Router v6
- [x] AuthContext
- [x] Connexion.js + Inscription.js
- [x] Profile.js component
- [x] Navbar avec auth check
- [x] ProtectedRoute wrapper
- [x] localStorage token management
- [x] apiClient.js avec Bearer token

**Database:**
- [x] MongoDB connection working
- [x] All models created and indexed
- [x] Email unique constraint

### ✅ Critères de Fin de Sprint
- [ ] `npm run api` et `npm start` sans erreurs
- [ ] User peut register/login
- [ ] JWT tokens valides et stockés
- [ ] Profil visible et modifiable
- [ ] Tous les models créés
- [ ] Zero console errors

---

## 📸 SPRINT 2: Scanning + Upload + Points (3 Semaines)

**Objectif:** Système complet de scanning IA avec scoring

### 📋 User Stories

#### US2.1: Détection d'Objets TensorFlow
```
TensorFlow.js avec COCO-SSD pour détecter objets

CRITÈRES D'ACCEPTATION:
✅ loadModel() charge COCO-SSD (< 3 secondes)
✅ detectObjects(image) retourne predictions (< 100ms)
✅ suggestMaterial(predictions) propose matériau
✅ Modèle caché en localStorage
```

#### US2.2: Interface de Scanning
```
Scanner avec caméra et upload

CRITÈRES D'ACCEPTATION:
✅ Scan.js avec caméra + upload
✅ navigator.mediaDevices pour caméra
✅ Aperçu avant soumission
✅ ScanResult.js affiche détections
✅ Material auto-fill par IA
```

#### US2.3: Upload & Scoring
```
Créer et sauvegarder les scans avec points

CRITÈRES D'ACCEPTATION:
✅ POST /api/scans crée scan avec photo
✅ Multer upload (5MB, jpeg/png/webp)
✅ Points calculés (+5 par scan)
✅ User.points incrémenté
✅ GET /api/scans/my historique paginé (10/page)
```

### 📦 Livrables

**Frontend:**
- [x] @tensorflow/tfjs installed
- [x] @tensorflow-models/coco-ssd installed
- [x] tensorflowUtils.js (loadModel, detectObjects, suggestMaterial)
- [x] Scan.js component (camera + upload + form)
- [x] ScanResult.js (display detections)
- [x] Scan.css (responsive)
- [x] Historique display with pagination

**Backend:**
- [x] scanController.js (createScan, getMyScans, getScan, deleteScan)
- [x] scanRoutes.js
- [x] Multer single photo setup
- [x] Points calculation logic
- [x] /uploads directory created
- [x] File validation (5MB, mime types)

**Database:**
- [x] Scans saved with references
- [x] User.points incremented
- [x] Indexes on userId, createdAt

### ✅ Critères de Fin de Sprint
- [ ] TensorFlow model loads <3 secondes
- [ ] Photos detected in <100ms
- [ ] Upload fonctionne
- [ ] Points incrementés (+5)
- [ ] Historique affiche scans
- [ ] Pagination fonctionne

---

## 💬 SPRINT 3: Forum + Comments + Leaderboard (3 Semaines)

**Objectif:** Système complet de forum avec modération et classement

### 📋 User Stories

#### US3.1: Posts CRUD
```
Créer, lire, modifier et supprimer des posts

CRITÈRES D'ACCEPTATION:
✅ POST /api/forum/posts crée post avec 6 images max
✅ GET /api/forum/posts liste paginée (10/page)
✅ PATCH /api/forum/posts/:id modifie post
✅ DELETE /api/forum/posts/:id supprime post
✅ Seul auteur ou admin peut modifier/supprimer
```

#### US3.2: Système de Commentaires
```
Commenter les posts et discuter

CRITÈRES D'ACCEPTATION:
✅ POST /api/forum/posts/:id/comments crée comment
✅ Comments visibles sous post
✅ PUT /api/forum/comments/:id modifie comment
✅ DELETE /api/forum/comments/:id supprime comment
✅ Seul auteur/admin peut modifier
```

#### US3.3: Modération & Leaderboard
```
Modérer les posts et afficher classement

CRITÈRES D'ACCEPTATION:
✅ Post.status (published, hidden, deleted)
✅ PATCH /api/admin/posts/:id/status (admin only)
✅ GET /api/leaderboard retourne top 100 users
✅ Leaderboard < 200ms aggregation
✅ Ma position visible même si pas top 100
```

### 📦 Livrables

**Backend:**
- [x] forumController.js (posts CRUD)
- [x] commentController.js (comments CRUD)
- [x] forumRoutes.js avec comments
- [x] Multer array("photos", 6)
- [x] Post & Comment validation
- [x] leaderboard aggregation (MongoDB)
- [x] Admin moderation endpoints
- [x] Permission checks

**Frontend:**
- [x] Forum.js (posts list)
- [x] PostDetail.js (detail + comments)
- [x] PostForm.js (create/edit with images)
- [x] Comments section UI
- [x] Leaderboard.js (top 100 + my position)
- [x] Image carousel
- [x] Pagination UI
- [x] Admin moderation UI

**Database:**
- [x] Post.images indexed
- [x] Comment.postId indexed
- [x] Leaderboard aggregation optimized

### ✅ Critères de Fin de Sprint
- [ ] Posts created/edited/deleted
- [ ] Images uploaded (max 6)
- [ ] Comments work
- [ ] Leaderboard shows ranking
- [ ] Moderation functional (hide/delete)
- [ ] Pagination responsive

---

## 🗺️ SPRINT 4: Géolocalisation + Meetings (2.5 Semaines)

**Objectif:** Localiser les centres et demander des rendez-vous

### 📋 User Stories

#### US4.1: Leaflet Map & Centres
```
Afficher les centres de recyclage sur une carte

CRITÈRES D'ACCEPTATION:
✅ Leaflet map + OpenStreetMap tiles
✅ Marqueurs verts pour centres
✅ Popups avec détails (nom, adresse, phone)
✅ Zoom/Pan fonctionnel
✅ Responsive mobile
```

#### US4.2: Récupération OSM
```
Remplir la base avec centres d'OpenStreetMap

CRITÈRES D'ACCEPTATION:
✅ Overpass API queries
✅ amenity=waste_basket & recycling
✅ Save to MongoDB
✅ 3 endpoints failover
```

#### US4.3: Recherche Géolocalisée & Meetings
```
Trouver centres près de moi et demander rencontre

CRITÈRES D'ACCEPTATION:
✅ Geolocation (navigator.geolocation)
✅ GET /api/centers/nearby?lat=X&lng=Y
✅ Haversine distance calculation
✅ Sort by distance
✅ POST /api/meetings (book appointment)
✅ PATCH /api/meetings/:id/status (approve/reject)
```

### 📦 Livrables

**Frontend:**
- [x] React Leaflet installed
- [x] RecyclingCenterMap.js (map component)
- [x] RecyclingCenters.js (list + map view)
- [x] Geolocation implementation
- [x] Filter par matériau
- [x] Distance display
- [x] Meeting.js (request form)
- [x] Mobile responsive

**Backend:**
- [x] centerController.js
- [x] centerRoutes.js
- [x] osm.js (Overpass API integration)
- [x] Haversine distance function
- [x] GET /api/centers/nearby
- [x] meetingController.js
- [x] meetingRoutes.js
- [x] POST /api/meetings

**Database:**
- [x] Centers imported from OSM
- [x] Location indexed (lat/lng)
- [x] Meeting requests stored

### ✅ Critères de Fin de Sprint
- [ ] Map displays centres
- [ ] Markers clickable
- [ ] Geolocation works
- [ ] Nearby search <200ms
- [ ] Meeting requests functional
- [ ] Distances calculated correctly

---

## 🚀 SPRINT 5: Testing + Optimization + Deployment (4 Semaines)

**Objectif:** Tester, optimiser et déployer le MVP en production

### 📋 User Stories

#### US5.1: Testing & QA Complets
```
Tester l'application complète

CRITÈRES D'ACCEPTATION:
✅ Tous endpoints testés (GET, POST, PATCH, DELETE)
✅ User flows validés
✅ Mobile responsive testé
✅ Zero critical bugs
✅ Performance benchmarks met
```

#### US5.2: Optimisation Performance
```
Optimiser l'app pour UX optimale

CRITÈRES D'ACCEPTATION:
✅ Frontend bundle < 1MB (gzipped)
✅ API responses < 200ms p95
✅ Images optimisées
✅ Lazy loading routes implemented
✅ Lighthouse > 90
✅ Service Worker
```

#### US5.3: Sécurité & Hardening
```
Sécuriser l'application pour production

CRITÈRES D'ACCEPTATION:
✅ Rate limiting (express-rate-limit)
✅ Input validation partout
✅ Error handling middleware
✅ Security headers (helmet)
✅ HTTPS enabled
✅ Environment variables configured
```

#### US5.4: Déploiement Production
```
Déployer l'application publiquement

CRITÈRES D'ACCEPTATION:
✅ Frontend déployé (Vercel)
✅ Backend déployé (Railway/Render)
✅ MongoDB Atlas connecté
✅ SSL certificates active
✅ Monitoring setup
✅ Backup strategy
✅ Documentation complete
```

### 📦 Livrables

**Backend:**
- [x] Rate limiting (express-rate-limit)
- [x] Input validation middleware
- [x] Error handling middleware
- [x] Logging system (morgan/winston)
- [x] Health check endpoint: GET /api/health
- [x] Security headers (helmet)
- [x] Production environment config

**Frontend:**
- [x] Code splitting
- [x] Lazy loading on routes
- [x] Image optimization
- [x] Service Worker
- [x] PWA manifest
- [x] Production build optimized
- [x] Lighthouse > 90

**DevOps:**
- [x] .env.production setup
- [x] CI/CD pipeline (GitHub Actions)
- [x] SSL/TLS certificates
- [x] Database backups automated
- [x] Monitoring dashboard
- [x] Error tracking (optional: Sentry)

**Documentation:**
- [x] README.md complete
- [x] API-REFERENCE.md finalized
- [x] DEPLOYMENT.md guide
- [x] MAINTENANCE.md procedures
- [x] Setup instructions
- [x] Troubleshooting guide

### ✅ Critères de Fin de Sprint (MVP GO LIVE!)
- [ ] MVP fully functional in production
- [ ] All tests passing
- [ ] Deployment successful
- [ ] Monitoring active
- [ ] Zero critical bugs
- [ ] Documentation complete
- [ ] Team trained

---

## 📅 Timeline Détaillée

```
MOIS 1: Sprint 1 - Fondations (3 semaines)
├─ Sem 1: Setup + Auth infrastructure
├─ Sem 2: Profils + Models
└─ Sem 3: Testing + Integration

MOIS 2: Sprint 2 - Scanning (3 semaines)
├─ Sem 1: TensorFlow.js setup
├─ Sem 2: Camera + Detection
└─ Sem 3: Upload + Points

MOIS 3: Sprint 3 - Forum (3 semaines)
├─ Sem 1: Posts CRUD
├─ Sem 2: Comments + Moderation
└─ Sem 3: Leaderboard

MOIS 4: Sprint 4 + 5 (6.5 semaines)
├─ Sem 1: Géolocation + Map
├─ Sem 2: Meetings + Nearby
├─ Sem 3-6: Testing + Optimization + Deployment
└─ GO LIVE!
```

---

## 📊 Dépendances Entre Sprints

```
Sprint 1 ✅ (Fondations)
    ↓
Sprint 2 ✅ (Scanning - dépend User + Auth)
    ↓
Sprint 3 ✅ (Forum - dépend User + Post models)
    ↓
Sprint 4 ✅ (Géolocation - dépend User + Meeting model)
    ↓
Sprint 5 ✅ (Deployment - dépend tous les sprints)
```

**Note:** Les sprints ne peuvent PAS être parallélisés (dépendances strictes)

---

## 👥 Allocation Équipe Recommandée

```
OPTION 1: 1 DEVELOPER
├─ Timeline: 4 mois exact
├─ Sprint 1-2: Backend focus (express + db)
├─ Sprint 3-4: Frontend heavy (react components)
├─ Sprint 5: Optimization + deployment
└─ Total: ~90-100 dev-days

OPTION 2: 2 DEVELOPERS (RECOMMANDÉ)
├─ Dev 1 (Backend): Sprints 1, 2, 4, 5
├─ Dev 2 (Frontend): Sprints 1, 2, 3, 5
├─ Parallelization: 2-3 sprints en même temps
└─ Timeline: 8-10 semaines (2-2.5 mois)

OPTION 3: 3 DEVELOPERS
├─ Dev 1 (Backend): Express + MongoDB
├─ Dev 2 (Frontend): React + UI
├─ Dev 3 (DevOps): Deploy + Infrastructure
└─ Timeline: ~6-8 semaines (1.5-2 mois)
```

---

## 📈 Estimation Charge

| Sprint | Durée | Effort | Backend | Frontend | Focus |
|--------|-------|--------|---------|----------|-------|
| 1 | 3 sem | 🟡 Moyen | 60% | 40% | Auth + Models |
| 2 | 3 sem | 🟠 Important | 30% | 70% | TensorFlow focus |
| 3 | 3 sem | 🟡 Moyen | 50% | 50% | Forum balanced |
| 4 | 2.5 sem | 🟡 Moyen | 40% | 60% | Map + Frontend |
| 5 | 4 sem | 🟠 Important | 40% | 40% | Testing + DevOps 20% |
| **Total** | **15.5 sem** | --- | --- | --- | **MVP Ready** |

---

## 🛠️ Tech Stack Final

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 19 + React Router 6 |
| **Backend** | Node.js + Express |
| **Database** | MongoDB |
| **IA** | TensorFlow.js + COCO-SSD |
| **Mapping** | Leaflet + OpenStreetMap |
| **Auth** | JWT + Refresh Tokens |
| **Upload** | Multer |
| **Deployment** | Vercel + Railway + MongoDB Atlas |

---

## 💰 Budget Estimé

| Service | Cost/Month | Notes |
|---------|-----------|-------|
| **Vercel** | $0-20 | Free tier fine for MVP |
| **Railway** | $5-50 | Free tier ok initially |
| **MongoDB Atlas** | $0 | Free tier 512MB |
| **Domain** | $0 | Can skip for MVP |
| **Total** | **$5-70** | Very flexible |

---

## ✅ Success Criteria (End of Sprint 5)

### MVP Features ✅
- [x] Users can register/login
- [x] Users can scan and get points
- [x] Forum with posts + comments
- [x] Leaderboard shows ranking
- [x] Map shows nearby centres
- [x] Can book meetings

### Quality Metrics ✅
- [x] Lighthouse > 90
- [x] API response < 200ms
- [x] Zero critical bugs
- [x] Mobile responsive
- [x] Documentation complete

### Production Ready ✅
- [x] Deployed to production
- [x] Monitoring active
- [x] Backups working
- [x] Team comfortable
- [x] Public MVP URL live

---

**Last Updated:** 22 Mai 2026 | **Status:** 🟡 Ready to Start Sprint 1
**Questions?** Check related documentation or sprint details above
