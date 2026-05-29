# 👥 Identification des Acteurs - EcoScan Recycle

## 🎯 Qu'est-ce qu'un Acteur?

Un **acteur** = Toute entité qui interagit avec le système (humaine ou logicielle)

```
        ACTEURS (WHO)
            ↓
    Interagissent avec
            ↓
        LE SYSTÈME
            ↓
    Pour accomplir des ACTIONS (WHAT)
```

---

## 📋 Liste des Acteurs Identifiés

### 1️⃣ **Client / Utilisateur Standard**

#### Profil
- **Type:** Humain
- **Rôle:** `client` (par défaut)
- **Permissions:** Lecture publique + Scan personnel
- **Type de compte:** Collecteur individuel OU Simple utilisateur

#### Caractéristiques
```javascript
{
  _id: ObjectId,
  firstName: "Ahmed",
  lastName: "Slimani",
  email: "ahmed@example.com",
  passwordHash: "$2b$12$...",
  role: "client",                    // ← Rôle standard
  accountType: "collecteur",         // ou "centre_de_collecte"
  points: 250,                       // Points gagnés via scans
  createdAt: "2026-01-15T10:30:00Z"
}
```

#### Cas d'Usage (User Stories)
```
1. S'inscrire/Se connecter
   ├─ POST /api/auth/register
   └─ POST /api/auth/login

2. Scanner des déchets
   ├─ Prendre photo
   ├─ IA détecte matériau
   ├─ POST /api/scans (+ gagne points)
   └─ Voir dans historique

3. Consulter les centres de recyclage
   ├─ GET /api/centers
   ├─ GET /api/centers/nearby (par localisation)
   └─ Voir détails + horaires + téléphone

4. Participer au forum
   ├─ GET /api/forum/posts (lire)
   ├─ POST /api/forum/posts (créer post)
   ├─ POST /api/forum/posts/:id/comments (commenter)
   └─ Voir profil + points des autres users

5. Demander une rencontre
   ├─ POST /api/meetings (avec centre de collecte)
   └─ Suivre le statut de la demande

6. Gérer son profil
   ├─ GET /api/users/me
   ├─ PATCH /api/users/me (modifier infos)
   └─ Voir ses points + statistiques
```

#### Permissions
```
✅ AUTORISÉ
  ├─ Voir tous les posts du forum (GET /api/forum/posts)
  ├─ Créer posts et comments (POST)
  ├─ Scanner et créer des scans (POST /api/scans)
  ├─ Modifier son propre profil (PATCH /api/users/me)
  ├─ Consulter les centres (GET /api/centers)
  ├─ Demander des rencontres (POST /api/meetings)
  └─ Voir l'historique de ses scans (GET /api/scans/my)

❌ INTERDIT
  ├─ Modifier posts d'autres utilisateurs
  ├─ Supprimer posts d'autres utilisateurs
  ├─ Accéder au dashboard admin
  ├─ Modifier les données de centres
  ├─ Voir les emails d'autres utilisateurs
  └─ Modifier les permissions d'autres
```

---

### 2️⃣ **Admin**

#### Profil
- **Type:** Humain
- **Rôle:** `admin`
- **Permissions:** Accès complet au système
- **Nombre:** 1-2 personnes généralement

#### Caractéristiques
```javascript
{
  _id: ObjectId,
  firstName: "Manager",
  lastName: "System",
  email: "admin@ecoscan.tn",
  role: "admin",                     // ← Rôle spécial
  permissions: [
    "manage_users",
    "manage_posts",
    "manage_centers",
    "manage_scans",
    "view_statistics",
    "export_data"
  ]
}
```

#### Cas d'Usage
```
1. Dashboard Admin
   ├─ Voir statistiques globales
   └─ GET /api/admin/stats

2. Gérer les utilisateurs
   ├─ Voir tous les users
   ├─ Bannir un utilisateur
   ├─ Réinitialiser password
   └─ Assigner des rôles

3. Modérer le forum
   ├─ GET /api/admin/posts (tous les posts)
   ├─ PATCH /api/admin/posts/:id/status (publier/cacher/supprimer)
   ├─ Supprimer comments offensants
   └─ Signaler les abuseurs

4. Gérer les centres de recyclage
   ├─ POST /api/admin/centers (créer)
   ├─ PATCH /api/admin/centers/:id (modifier)
   ├─ DELETE /api/admin/centers/:id (supprimer)
   └─ Vérifier les données OSM

5. Valider les scans
   ├─ GET /api/admin/scans
   ├─ Vérifier la qualité des détections
   └─ Marquer comme verified/rejected

6. Exporter statistiques
   ├─ Export CSV/JSON
   ├─ Rapport mensuel
   └─ Analyse de données
```

#### Permissions
```
✅ AUTORISÉ (Tout)
  ├─ Lire/Modifier/Supprimer tous les posts
  ├─ Modifier les scans d'autres users
  ├─ Ajouter/Modifier/Supprimer des centres
  ├─ Assigner des rôles (client → moderator)
  ├─ Voir statistiques globales
  ├─ Exporter les données
  ├─ Accéder à l'API admin
  └─ Voir logs système

❌ INTERDIT
  ├─ Changer le mot de passe d'autres (sauf reset)
  ├─ Accéder aux données externes (API keys)
  └─ Modifier le code du système (?)
```

---

### 3️⃣ **Modérateur Forum**

#### Profil
- **Type:** Humain
- **Rôle:** `moderator`
- **Permissions:** Modération du forum uniquement
- **Nombre:** 3-5 personnes

#### Caractéristiques
```javascript
{
  _id: ObjectId,
  firstName: "Moderator",
  lastName: "Forum",
  email: "mod@ecoscan.tn",
  role: "moderator",                 // ← Rôle spécial
  permissions: [
    "moderate_forum",
    "hide_posts",
    "delete_comments",
    "warn_users"
  ]
}
```

#### Cas d'Usage
```
1. Modérer les posts
   ├─ Lire tous les posts (même masqués)
   ├─ Cacher/Afficher un post (PATCH /api/posts/:id/status)
   ├─ Supprimer les comments offensants
   └─ Avertir les utilisateurs

2. Signaler les violations
   ├─ Spam détecté
   ├─ Contenu inapproprié
   ├─ Harcèlement
   └─ Signaler à l'admin

3. Gérer les discussions
   ├─ Épingler les posts importants
   ├─ Fermer les discussions houleuses
   └─ Archiver les discussions anciennes
```

#### Permissions
```
✅ AUTORISÉ
  ├─ Voir tous les posts (même status: "hidden")
  ├─ Cacher/Afficher les posts
  ├─ Supprimer les comments
  ├─ Avertir les utilisateurs
  └─ Accéder à l'interface de modération

❌ INTERDIT
  ├─ Modifier les posts (que supprimer)
  ├─ Bannir les utilisateurs
  ├─ Accéder aux données personnelles
  ├─ Voir les emails
  └─ Accéder au dashboard admin
```

---

### 4️⃣ **Centre de Collecte**

#### Profil
- **Type:** Entité / Organisation (mais contrôlée par humain)
- **Role dans système:** `client` avec `accountType: "centre_de_collecte"`
- **Permissions:** Gérer les demandes de rencontre
- **Nombre:** 100+ centres en Tunisie

#### Caractéristiques
```javascript
{
  _id: ObjectId,
  centerName: "Centre Vert Tunis",
  city: "Tunis",
  latitude: 36.8065,
  longitude: 10.1619,
  phone: "+216 71 123 456",
  materialsAccepted: ["plastique", "verre", "metal", "papier_carton"],
  openingHours: "08:00-17:00",
  rating: 4.5,
  totalReviews: 234,
  isVerified: true,
  
  // Champs optionnels
  managerName: "Ali Ben Ahmed",
  managerEmail: "manager@centrevert.tn",
  website: "https://centrevert.tn",
  description: "Centre de recyclage certifié ISO 14001"
}
```

#### Cas d'Usage
```
1. Être découvert par les utilisateurs
   ├─ GET /api/centers (liste publique)
   ├─ GET /api/centers/nearby (par géolocalisation)
   └─ Voir détails + commentaires + note

2. Recevoir des demandes de rencontre
   ├─ User → POST /api/meetings (avec centerUserId)
   ├─ Centre → GET /api/meetings/inbox (voir demandes)
   ├─ Centre → Accepter/Refuser la rencontre
   └─ User → Voir statut de sa demande

3. Être noté/Commenté
   ├─ Users laissent des avis
   ├─ Rating calculé automatiquement
   └─ Avis visibles sur fiche centre

4. Être promu dans le forum
   ├─ Profil visible dans les posts
   ├─ Lien vers sa fiche centre
   └─ Possibilité de répondre aux questions
```

#### Permissions
```
✅ AUTORISÉ
  ├─ Être visible dans la liste des centres
  ├─ Recevoir des demandes de rencontre
  ├─ Voir les demandes dans son inbox
  ├─ Accepter/Refuser les demandes
  ├─ Participer au forum (comme utilisateur normal)
  ├─ Répondre aux questions des users
  └─ Voir sa note et ses avis

❌ INTERDIT
  ├─ Modifier ses propres données (sauf manager)
  ├─ Supprimé des listes publiques
  ├─ Bannir d'autres utilisateurs
  └─ Accéder aux données d'autres centres
```

---

### 5️⃣ **Collecteur / Scanniste (Power User)**

#### Profil
- **Type:** Humain engagé
- **Rôle:** `client` avec engagement élevé
- **Points:** Élevés (500+)
- **Activité:** Scanner régulièrement

#### Caractéristiques
```javascript
{
  _id: ObjectId,
  firstName: "Éco-Guerrier",
  email: "ecolover@example.com",
  role: "client",
  accountType: "collecteur",
  points: 1250,                      // Très élevé
  scanHistory: [                     // Historique long
    { scanId: "...", material: "plastique", pointsEarned: 10 },
    { scanId: "...", material: "verre", pointsEarned: 15 },
    // ... 100+ entrées
  ],
  level: "Gold",                     // Badge / Niveau
  achievements: [
    "100_scans",
    "recycling_champion",
    "weekly_streak"
  ]
}
```

#### Cas d'Usage
```
1. Scanner massivement
   ├─ POST /api/scans (multiple fois par jour)
   ├─ Accumuler les points
   └─ Débloquer des badges

2. Compétition/Leaderboard
   ├─ GET /api/leaderboard
   ├─ Voir sa position (rang 5 sur 1000)
   ├─ Tracker sa progression
   └─ Participer à des défis mensuels

3. Partager l'engagement
   ├─ Créer des posts de motivation
   ├─ Commenter les posts d'autres scanneurs
   ├─ Créer des groupes communautaires
   └─ Organiser des événements

4. Accéder à des récompenses
   ├─ Réductions chez les centres
   ├─ Produits écologiques gratuits
   ├─ Certifications
   └─ Statut "Ambassadeur EcoScan"
```

#### Permissions
```
✅ AUTORISÉ (Comme client normal + plus)
  ├─ Scanner multiple fois par jour
  ├─ Voir le leaderboard
  ├─ Débloquer des achievements
  ├─ Accéder à des récompenses spéciales
  ├─ Exporter son historique personnel
  └─ Inviter d'autres utilisateurs (futur)

❌ INTERDIT
  ├─ Faire du spam de scans
  ├─ Modifier les résultats IA
  └─ Accéder aux fonctions admin
```

---

### 6️⃣ **Système / Backend**

#### Profil
- **Type:** Logiciel / Entité système
- **Role:** Orchestrer toutes les opérations
- **Rôle:** N/A (système lui-même)

#### Responsabilités
```
1. Authentification & Sécurité
   ├─ Valider les JWT tokens
   ├─ Hasher les passwords
   ├─ Gérer les sessions
   └─ Appliquer les limites de taux (rate limiting)

2. Détection IA
   ├─ Charger le modèle COCO-SSD
   ├─ Détecter les objets
   ├─ Mapper vers les matériaux
   └─ Calculer la confiance

3. Gestion des données
   ├─ Sauvegarder les scans
   ├─ Indexer les posts
   ├─ Calculer les statistiques
   └─ Nettoyer les anciennes données

4. Notifications (futur)
   ├─ Email de bienvenue
   ├─ Notification de réaction
   ├─ Alerte de rencontre
   └─ Rappel de scan quotidien

5. Intégrations externes
   ├─ OpenStreetMap Overpass API (centres)
   ├─ TensorFlow.js (détection)
   ├─ MongoDB (stockage)
   └─ Cloudinary (images - optionnel)

6. Audit & Logs
   ├─ Logger les actions sensibles
   ├─ Tracker les erreurs
   ├─ Monitorer la performance
   └─ Générer des rapports
```

---

### 7️⃣ **OpenStreetMap (Système Externe)**

#### Profil
- **Type:** API externe
- **Rôle:** Fournir les données géographiques
- **Interaction:** Requêtes Overpass API

#### Cas d'Usage
```
1. Récupérer les centres de recyclage
   ├─ Query: amenity=waste_basket OR amenity=recycling
   ├─ Backend → Overpass API → GeoJSON
   └─ Sauvegarder en MongoDB

2. Enrichir les données
   ├─ Latitude / Longitude
   ├─ Types de matériaux acceptés (tags)
   ├─ Horaires d'ouverture
   └─ Contacts

3. Localiser l'utilisateur
   ├─ User partage sa localisation
   ├─ Trouver les centres à proximité (Haversine distance)
   └─ Afficher sur la carte
```

---

### 8️⃣ **TensorFlow.js (Système Externe)**

#### Profil
- **Type:** Modèle ML / Librairie
- **Rôle:** Détection d'objets
- **Interaction:** Côté client (frontend)

#### Cas d'Usage
```
1. Charger le modèle
   ├─ Télécharger COCO-SSD (~140MB)
   ├─ Mettre en cache localement
   └─ Réutiliser pour les prochaines détections

2. Détecter les objets
   ├─ Image input → modèle
   ├─ Output: [{ class, score, bbox }]
   └─ Utiliser pour suggérer le matériau

3. Optimisations
   ├─ Utiliser GPU si disponible
   ├─ Batch processing (futur)
   └─ Compression du modèle
```

---

## 🔄 Matrice d'Interactions

```
                │ Client │ Modérateur │ Centre │ Admin │ Système
────────────────┼────────┼────────────┼────────┼───────┼─────────
Créer Post      │   ✓    │     ✓      │   ✓    │   ✓   │    -
Modifier Post   │  Own   │     -      │  Own   │   ✓   │    -
Supprimer Post  │  Own   │  Report    │  Own   │   ✓   │    -
Scanner         │   ✓    │     -      │   -    │   ✓   │    -
Voir Centres    │   ✓    │     ✓      │   -    │   ✓   │    -
Modérer Forum   │   -    │     ✓      │   -    │   ✓   │    -
Gérer Users     │   -    │     -      │   -    │   ✓   │    -
Données OSM     │   -    │     -      │   -    │   -   │    ✓
Détection IA    │   ✓*   │     -      │   -    │   -   │    ✓
```

*Client = côté frontend (TensorFlow.js)

---

## 👥 Diagramme UML - Use Case

```
                        ┌─────────────────┐
                        │  Client/User    │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼───┐  ┌────▼────┐ ┌────▼────┐
              │  Scanner │  │  Forum  │ │ Centers │
              └──────────┘  └─────────┘ └─────────┘
                    │            │            │
                    ┌────────────┼────────────┘
                    │
              ┌─────▼──────────┐
              │ EcoScan System │
              └────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
    ┌────▼───┐ ┌───▼────┐ ┌──▼──────┐
    │MongoDB │ │TensorFlow│ │OpenStreetMap│
    └────────┘ └────────┘ └─────────┘

        ┌─────────────────────┐
        │ Modérateur Forum    │
        └──────────┬──────────┘
                   │
             ┌─────▼─────┐
             │Modération │
             │du Forum   │
             └───────────┘
                   │
          ┌────────▼────────┐
          │  EcoScan System │
          └──────────────────┘

        ┌──────────────────┐
        │      Admin       │
        └────────┬─────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
  ┌───▼──┐ ┌────▼───┐ ┌───▼────┐
  │Users │ │Dashboard│ │Reports │
  └──────┘ └────────┘ └────────┘

        ┌──────────────────┐
        │ Centre Collecte  │
        └────────┬─────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
  ┌───▼──────┐      ┌──────▼──┐
  │Demandes  │      │Profil   │
  │Rencontre │      │Centre   │
  └──────────┘      └─────────┘
```

---

## 📊 Matrice RACI - Responsabilités

```
Activité                │ Client │ Modérateur │ Centre │ Admin │ Système
────────────────────────┼────────┼────────────┼────────┼───────┼────────
Créer un scan           │ **R**  │      -     │   -    │   -   │  **S**
Valider détection IA    │   -    │      -     │   -    │ **R** │  **S**
Créer un post           │ **R**  │      -     │   **R**│   -   │  **S**
Modérer post offensant  │   -    │    **R**   │   -    │ **A** │   -
Gérer centre            │   -    │      -     │   -    │ **R** │  **S**
Calculer points         │   -    │      -     │   -    │   -   │  **R**
Recevoir demande        │   -    │      -     │ **R**  │   -   │  **S**
Monitorer système       │   -    │      -     │   -    │ **R** │  **S**

Legend:
  R = Responsible (Qui fait?)
  A = Accountable (Qui approuve?)
  C = Consulted (Qui consulte?)
  I = Informed (Qui est informé?)
  S = Supported by (Soutenu par)
  - = Non applicable
```

---

## 🎭 Scénarios Typiques

### Scénario 1: Un Client Scanner un Déchet

```
1. Client ouvre l'app
   └─ Système: loadModel() TensorFlow.js

2. Client prend photo d'une bouteille
   └─ Frontend: processImageFile()

3. IA détecte "bottle" (96% confiance)
   └─ Frontend: suggestMaterial() → "plastique"

4. Client valide et soumet
   └─ Frontend: POST /api/scans

5. Système reçoit et valide
   └─ Backend: authMiddleware ✓, Multer upload ✓

6. Système crée scan et incrément points
   └─ Backend: Scan.create() + User.updateOne({ $inc: { points: 10 } })

7. Système répond avec confirmation
   └─ Response 201: { scan, userStats }

8. Client voit +10 points dans son profil
   └─ Frontend: mise à jour du state
```

### Scénario 2: Un Admin Modère un Post Offensant

```
1. Admin accède au dashboard
   └─ Frontend: auth check role === "admin"

2. Admin voit post signalé
   └─ GET /api/admin/posts?status=reported

3. Admin lit le post
   └─ Contenu: Publicité d'une marque polluante

4. Admin clique "Cacher"
   └─ PATCH /api/admin/posts/:id/status
   └─ Body: { status: "hidden", reason: "Commercial spam" }

5. Système met à jour le post
   └─ Post.updateOne({ status: "hidden" })

6. Système avertit l'utilisateur
   └─ Email: "Votre post a été caché"

7. Forum cache le post pour tous les clients
   └─ GET /api/forum/posts filtre status !== "hidden"
```

### Scénario 3: Un Centre Reçoit une Demande de Rencontre

```
1. Client demande rencontre
   └─ POST /api/meetings
   └─ Body: { centerUserId, datePreference }

2. Système crée MeetingRequest
   └─ MeetingRequest.create()

3. Système notifie le centre
   └─ Email / Notification: "Nouvelle demande!"

4. Centre voit dans son inbox
   └─ GET /api/meetings/inbox

5. Centre accepte la demande
   └─ PATCH /api/meetings/:id
   └─ Body: { status: "accepted" }

6. Système met à jour et notifie client
   └─ Client: GET /api/meetings/my → voir statut "accepted"

7. Client et centre peuvent se contacter
   └─ Email affichée / Contact facilité
```

---

## 🔐 Matrice de Permissions Détaillée

### Endpoints et Rôles Requis

```
AUTHENTIFICATION
POST   /api/auth/register          │ ❌ (Public)
POST   /api/auth/login             │ ❌ (Public)
POST   /api/auth/refresh           │ ❌ (Public)
POST   /api/auth/logout            │ ✓ (Tous authentifiés)

USERS
GET    /api/users/me               │ ✓ Client (lui-même)
PATCH  /api/users/me               │ ✓ Client (lui-même)
POST   /api/users/logout-all       │ ✓ Client (lui-même)

SCANS
POST   /api/scans                  │ ✓ Client
GET    /api/scans/my               │ ✓ Client (ses scans)
GET    /api/scans/:id              │ ✓ Tous (public)
DELETE /api/scans/:id              │ ✓ Client (propriétaire) | Admin
GET    /api/scans/stats            │ ✓ Client (stats perso)

FORUM
GET    /api/forum/posts            │ ✓ Tous (public)
POST   /api/forum/posts            │ ✓ Client
GET    /api/forum/posts/:id        │ ✓ Tous (public)
PUT    /api/forum/posts/:id        │ ✓ Client (propriétaire)
DELETE /api/forum/posts/:id        │ ✓ Client (propriétaire) | Mod | Admin
POST   /api/forum/posts/:id/comments│ ✓ Client
PUT    /api/forum/posts/:id/comments/:cId │ ✓ Client (propriétaire)
DELETE /api/forum/posts/:id/comments/:cId │ ✓ Client (propriétaire) | Mod | Admin

CENTERS
GET    /api/centers                │ ✓ Tous (public)
GET    /api/centers/nearby         │ ✓ Tous (public)
GET    /api/centers/osm            │ ✓ Admin
POST   /api/admin/centers          │ ✓ Admin
PATCH  /api/admin/centers/:id      │ ✓ Admin
DELETE /api/admin/centers/:id      │ ✓ Admin

MEETINGS
POST   /api/meetings                │ ✓ Client
GET    /api/meetings/my             │ ✓ Client
GET    /api/meetings/inbox          │ ✓ Centre (directeur)
PATCH  /api/meetings/:id            │ ✓ Centre (directeur) | Admin

ADMIN
GET    /api/admin/stats             │ ✓ Admin
GET    /api/admin/posts             │ ✓ Admin | Mod
GET    /api/admin/scans             │ ✓ Admin
PATCH  /api/admin/posts/:id/status  │ ✓ Admin | Mod
DELETE /api/admin/posts/:id         │ ✓ Admin
```

---

## 📱 Différents Interfaces par Acteur

```
CLIENT
├─ Dashboard
│  ├─ Mes scans (historique)
│  ├─ Mes points (leaderboard)
│  ├─ Profil
│  └─ Paramètres
├─ Scanner
│  ├─ Caméra
│  ├─ Upload photo
│  └─ IA détection
├─ Forum
│  ├─ Lire posts
│  ├─ Créer post
│  └─ Commenter
└─ Centres
   ├─ Voir liste
   ├─ Voir sur carte
   └─ Demander rencontre

MODÉRATEUR
├─ Dashboard Modération
│  ├─ Posts signalés
│  ├─ Comments à checker
│  └─ Utilisateurs suspects
├─ Outils
│  ├─ Cacher post
│  ├─ Supprimer comment
│  ├─ Avertir utilisateur
│  └─ Rapporter à admin

ADMIN
├─ Dashboard Administrateur
│  ├─ Statistiques globales
│  ├─ Graphiques activité
│  ├─ Revenue / Points
│  └─ Erreurs système
├─ Gestion Users
│  ├─ Liste des users
│  ├─ Profils détaillés
│  ├─ Assigner rôles
│  └─ Bannir utilisateurs
├─ Gestion Contenu
│  ├─ Posts
│  ├─ Scans
│  ├─ Centres
│  └─ Commentaires
└─ Exports
   ├─ Rapports CSV
   ├─ Analyse données
   └─ Audits

CENTRE DE COLLECTE
├─ Profil Centre
│  ├─ Informations
│  ├─ Matériaux acceptés
│  ├─ Horaires
│  └─ Contact
├─ Demandes
│  ├─ Inbox des demandes
│  ├─ Accepter/Refuser
│  └─ Historique rencontres
└─ Forum
   ├─ Répondre questions
   ├─ Partager infos
   └─ Profil public
```

---

## 🎯 Résumé: Qui Fait Quoi?

| Acteur | PRIMARY ACTIONS | INTERACTIONS |
|--------|-----------------|--------------|
| **Client** | Scanner, Créer posts, Chercher centres | Avec système, forum, autres users |
| **Modérateur** | Modérer forum, Cacher posts | Avec system, forum |
| **Admin** | Gérer tout | Avec système, users, contenus |
| **Centre** | Recevoir demandes, Publier infos | Avec clients, système |
| **Système** | Orchestrer, Sauvegarder, Notifier | Avec tous les acteurs + APIs |
| **TensorFlow** | Détecter objets | Avec système (frontend) |
| **OpenStreetMap** | Fournir données géo | Avec système |

---

**À présent, tous les acteurs d'EcoScan sont identifiés et documentés! 👥**
