# Diagrammes UML — EcoScan Recycle (Rapport de stage)

> Document de référence pour les chapitres 2 à 7 du rapport.  
> Aligné sur les modèles Mongoose réels (`backend/api/models/`).

---

## Corrections par rapport à votre diagramme actuel

| Problème dans votre diagramme | Correction |
|------------------------------|------------|
| `Admin` hérite de `User` avec les mêmes attributs | **Collections séparées** : `Admin` a `permissions`, `adminLevel`, `approvedBy` |
| Classe `City` avec email, login, register… | **Corrigée** : entité géographique (`cityName`, `governorate`, `country`…) liée aux centres |
| `PointsHistory` isolé | Lié à `User` (1..*) et optionnellement à `Scan` (0..1) |
| `Notification` liée à `User` ET `RecyclingCenter` | Liée à `User` ; référence polymorphe via `relatedId` + `relatedModel` |
| Types incorrects (`pointsEarned: String`, `metadata: Number`) | `pointsEarned: Number`, `metadata: Object` (confidence, photoUrl, notes) |
| Pas de `RefreshToken` | Classe embarquée dans `User` |
| `RecyclingCenter` sans auth | Compte complet avec `email`, `passwordHash`, géolocalisation |

---

## 1. Diagramme de classes GLOBAL (corrigé)

```mermaid
classDiagram
    direction TB

    class User {
        +ObjectId _id
        +String firstName
        +String lastName
        +String email
        +String passwordHash
        +String role
        +String accountType
        +String phone
        +String address
        +Number points
        +RefreshToken[] refreshTokens
        +Date createdAt
        +Date updatedAt
        +comparePassword(password) Boolean
        +hashPassword(password) String$
    }

    class RefreshToken {
        +String tokenIdHash
        +Date expiresAt
        +Date revokedAt
        +String replacedByTokenIdHash
    }

    class Admin {
        +ObjectId _id
        +String firstName
        +String lastName
        +String email
        +String passwordHash
        +String role
        +String[] permissions
        +String adminLevel
        +Date approvalDate
        +ObjectId approvedBy
        +comparePassword(password) Boolean
        +hasPermission(permission) Boolean
        +approveUser(userId, status) Object
        +removeContent(contentId, type) Object
        +generateReport(type, range) Object
    }

    class City {
        +ObjectId _id
        +String cityName
        +String governorate
        +String country
        +String postalCode
        +Number latitude
        +Number longitude
        +Number population
        +Boolean isActive
        +getCenters() RecyclingCenter[]
        +getCentersCount() Number
    }

    class RecyclingCenter {
        +ObjectId _id
        +ObjectId cityId
        +String centerName
        +String managerName
        +String registrationNumber
        +String centerType
        +String[] materialsAccepted
        +String address
        +String openingHours
        +String[] closingDays
        +Number capacityPerDayKg
        +Number currentCapacityKg
        +Number latitude
        +Number longitude
        +Boolean isVerified
        +Number rating
        +getAvailableCapacity() Number
        +canAcceptMaterial(material) Boolean
        +updateOperatingHours(hours) Boolean
    }

    class Scan {
        +ObjectId _id
        +ObjectId userId
        +String label
        +String material
        +Boolean recyclable
        +String instructions
        +Number points
        +String photoUrl
        +Date createdAt
        +Date updatedAt
    }

    class PointsHistory {
        +ObjectId _id
        +ObjectId userId
        +ObjectId scanId
        +String material
        +Number pointsEarned
        +String reason
        +String description
        +String status
        +Object metadata
        +Date createdAt
    }

    class Post {
        +ObjectId _id
        +ObjectId authorId
        +String title
        +String content
        +String[] tags
        +String status
        +Image[] images
        +Date createdAt
        +Date updatedAt
    }

    class Comment {
        +ObjectId _id
        +ObjectId postId
        +ObjectId authorId
        +String content
        +ObjectId parentCommentId
        +String status
        +Date createdAt
    }

    class MeetingRequest {
        +ObjectId _id
        +ObjectId requesterId
        +ObjectId centerUserId
        +Date preferredDate
        +String message
        +String status
        +String material
        +ObjectId scanId
        +Date acceptedAt
        +Date rejectedAt
        +Date meetingConfirmedDate
    }

    class Notification {
        +ObjectId _id
        +ObjectId userId
        +String type
        +String title
        +String message
        +ObjectId relatedId
        +String relatedModel
        +Object data
        +Boolean isRead
        +Date readAt
        +Date expiresAt
    }

    User "1" *-- "0..*" RefreshToken : contient
    User "1" --> "0..*" Scan : effectue
    User "1" --> "0..*" Post : publie
    User "1" --> "0..*" Comment : rédige
    User "1" --> "0..*" MeetingRequest : demande
    User "1" --> "0..*" Notification : reçoit
    User "1" --> "0..*" PointsHistory : accumule

    Scan "0..1" --> "0..1" PointsHistory : génère
    Scan "0..1" --> "0..*" MeetingRequest : référence

    Post "1" --> "0..*" Comment : contient
    Comment "0..1" --> "0..*" Comment : réponses

    City "1" --> "0..*" RecyclingCenter : contient
    RecyclingCenter "1" --> "0..*" MeetingRequest : reçoit

    Admin "0..1" --> "0..*" Admin : approuve
```

### Légende des cardinalités

| Relation | Signification |
|----------|---------------|
| User → Scan | Un utilisateur peut avoir plusieurs scans |
| User → PointsHistory | Chaque gain de points est tracé |
| Scan → PointsHistory | Un scan peut générer une entrée d'historique |
| Post → Comment | Un post a plusieurs commentaires |
| Comment → Comment | Réponses imbriquées (`parentCommentId`) |
| City → RecyclingCenter | Une ville contient plusieurs centres (`cityId`) |
| User → MeetingRequest | L'utilisateur demande un rendez-vous |
| RecyclingCenter → MeetingRequest | Le centre reçoit la demande |
| User → Notification | Destinataire des alertes système |

### Note pour draw.io

- **Ne pas** utiliser une flèche d'héritage entre `User` et `Admin`.
- `City` regroupe les centres par localisation (`cityName`, `governorate`, `country`).
- `Admin` et `RecyclingCenter` sont des **acteurs autonomes** avec authentification propre.

---

## 2. Diagramme de contexte (Chapitre 2 — Figure 7)

```mermaid
flowchart TB
    subgraph Acteurs["Acteurs externes"]
        U[👤 Utilisateur]
        A[🔧 Administrateur]
        C[🏢 Centre de recyclage]
    end

    subgraph EcoScan["Système EcoScan Recycle"]
        FE[Frontend React.js]
        BE[Backend Express.js MVC]
        DB[(MongoDB)]
        FE <--> BE
        BE <--> DB
    end

    subgraph Externes["Services externes"]
        TF[TensorFlow.js COCO-SSD]
        OSM[OpenStreetMap / Leaflet]
    end

    U -->|Auth, scans, forum, RDV| BE
    BE -->|JWT, données, points| U
    A -->|Modération, stats, users| BE
    BE -->|Rapports, dashboard| A
    C -->|Inbox RDV, profil| BE
    BE -->|Notifications| C
    FE -->|Détection image| TF
    TF -->|Matériau suggéré| FE
    BE -->|Centres OSM| OSM
    OSM -->|GeoJSON| BE
    U --> FE
    A --> FE
    C --> FE
```

---

## 3. Diagramme de cas d'utilisation GLOBAL (Chapitre 2 — §4.3)

```mermaid
flowchart LR
    subgraph Utilisateur
        UC1[S'inscrire / Se connecter]
        UC2[Gérer son profil]
        UC3[Scanner un déchet]
        UC4[Consulter historique scans]
        UC5[Localiser centres]
        UC6[Demander rendez-vous]
        UC7[Publier / commenter]
        UC8[Consulter classement]
        UC9[Suivre impact écologique]
    end

    subgraph Admin
        UA1[Gérer utilisateurs]
        UA2[Modérer publications]
        UA3[Superviser centres]
        UA4[Consulter statistiques]
    end

    subgraph Centre
        UCe1[Gérer informations centre]
        UCe2[Consulter demandes RDV]
        UCe3[Accepter / refuser RDV]
    end

    SYS((EcoScan Recycle))

    UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9 --> SYS
    UA1 & UA2 & UA3 & UA4 --> SYS
    UCe1 & UCe2 & UCe3 --> SYS
```

---

## 4. Diagrammes par sprint

### Sprint 1 — Authentification (Chapitre 3)

#### Classes (sous-ensemble)

```mermaid
classDiagram
    class User {
        +register()
        +login()
        +updateProfile()
        +comparePassword()
    }
    class RefreshToken {
        +tokenIdHash
        +expiresAt
    }
    User *-- RefreshToken
```

#### Séquence — S'inscrire

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express API
    participant DB as MongoDB

    U->>R: Remplit formulaire inscription
    R->>API: POST /api/auth/register
    API->>API: Valider données + hashPassword
    API->>DB: User.create()
    DB-->>API: user document
    API->>API: Générer JWT + refresh token
    API-->>R: 201 { accessToken, refreshToken, user }
    R-->>U: Redirection accueil
```

#### Séquence — Se connecter

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express API
    participant DB as MongoDB

    U->>R: Email + mot de passe
    R->>API: POST /api/auth/login
    API->>DB: User.findOne({ email })
    DB-->>API: user
    API->>API: comparePassword()
    alt Mot de passe invalide
        API-->>R: 401 Unauthorized
    else Mot de passe valide
        API->>API: signAccessToken() + createRefreshToken()
        API->>DB: Sauvegarder refresh token
        API-->>R: 200 { accessToken, refreshToken }
        R->>R: Stocker tokens (localStorage)
        R-->>U: Accès plateforme
    end
```

---

### Sprint 2 — Scan intelligent + Points (Chapitre 4)

#### Classes

```mermaid
classDiagram
    User "1" --> "0..*" Scan
    User "1" --> "0..*" PointsHistory
    Scan "0..1" --> PointsHistory
```

#### Cas d'utilisation raffiné

```mermaid
flowchart TB
    U[Utilisateur] --> UC1[Scanner un objet]
    U --> UC2[Importer une image]
    U --> UC3[Consulter résultat détection]
    U --> UC4[Consulter historique scans]
    SYS[Système] --> UC5[Gagner des points]
    UC1 -.->|include| UC2
    UC1 -.->|include| UC3
    UC1 --> UC5
```

#### Activité — Scanner un objet

```mermaid
flowchart TD
    A([Début]) --> B{Caméra ou upload?}
    B -->|Caméra| C[Activer getUserMedia]
    B -->|Upload| D[Sélectionner fichier]
    C --> E[Capturer image]
    D --> E
    E --> F[Charger modèle TensorFlow.js]
    F --> G[Détecter objets COCO-SSD]
    G --> H{Confiance > 50%?}
    H -->|Non| I[Saisie manuelle matériau]
    H -->|Oui| J[Proposer matériau]
    I --> K[Valider label + matériau]
    J --> K
    K --> L[POST /api/scans + photo]
    L --> M[Calculer points + PointsHistory]
    M --> N[Mettre à jour User.points]
    N --> O([Afficher résultat + points])
```

#### Séquence — Scanner un objet

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React + TensorFlow.js
    participant API as Express
    participant PS as PointsService
    participant DB as MongoDB

    U->>R: Capture / upload image
    R->>R: model.detect(image)
    R-->>U: Matériau suggéré
    U->>R: Confirmer et soumettre
    R->>API: POST /api/scans (multipart + JWT)
    API->>API: authMiddleware
    API->>DB: Scan.create()
    API->>PS: awardPoints(userId, scan)
    PS->>DB: PointsHistory.create()
    PS->>DB: User.updateOne({ $inc: points })
    API-->>R: 201 { scan, pointsEarned }
    R-->>U: Confirmation + points
```

#### Séquence — Consulter historique

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express
    participant DB as MongoDB

    U->>R: Ouvrir historique (page N)
    R->>API: GET /api/scans/my?page=N&limit=10
    API->>API: Vérifier JWT
    API->>DB: Scan.find({ userId }).sort().skip().limit()
    DB-->>API: scans + total
    API-->>R: 200 { scans, pagination }
    R-->>U: Liste paginée
```

---

### Sprint 3 — Forum + Classement (Chapitre 5)

#### Classes

```mermaid
classDiagram
    User "1" --> "0..*" Post : authorId
    Post "1" --> "0..*" Comment : postId
    User "1" --> "0..*" Comment : authorId
    Comment "0..1" --> "0..*" Comment : parentCommentId
```

#### Activité — Créer une publication

```mermaid
flowchart TD
    A([Début]) --> B[Ouvrir formulaire publication]
    B --> C[Saisir titre + contenu]
    C --> D{Images?}
    D -->|Oui| E[Upload images]
    D -->|Non| F[Valider côté client]
    E --> F
    F --> G{Données valides?}
    G -->|Non| H[Message erreur]
    H --> B
    G -->|Oui| I[POST /api/forum/posts]
    I --> J[Enregistrer MongoDB]
    J --> K([Afficher confirmation])
```

#### Séquence — Créer une publication

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express
    participant DB as MongoDB

    U->>R: Saisir titre, contenu, images
    R->>API: POST /api/forum/posts (JWT)
    API->>API: Valider + authMiddleware
    API->>DB: Post.create({ authorId, title, content })
    DB-->>API: post
    API-->>R: 201 { post }
    R-->>U: Publication visible dans le forum
```

#### Séquence — Consulter le classement

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express
    participant DB as MongoDB

    U->>R: Accéder au leaderboard
    R->>API: GET /api/users/leaderboard
    API->>DB: User.find().sort({ points: -1 }).limit()
    DB-->>API: utilisateurs triés
    API-->>R: 200 { leaderboard, myRank }
    R-->>U: Afficher classement
```

---

### Sprint 4 — Géolocalisation + Centres (Chapitre 6)

#### Classes

```mermaid
classDiagram
    class City {
        +cityName: String
        +governorate: String
    }
    class RecyclingCenter {
        +cityId: ObjectId
        +latitude: Number
        +longitude: Number
        +materialsAccepted: String[]
    }
    class MeetingRequest {
        +requesterId
        +centerUserId
        +status
    }
    User --> MeetingRequest : demande
    RecyclingCenter --> MeetingRequest : reçoit
```

#### Activité — Rechercher centres proches

```mermaid
flowchart TD
    A([Début]) --> B[Ouvrir carte Leaflet]
    B --> C{Géolocalisation autorisée?}
    C -->|Non| D[Message erreur + saisie manuelle]
    C -->|Oui| E[getCurrentPosition]
    E --> F[GET /api/centers/nearby?lat&lng]
    F --> G[Calcul distance Haversine]
    G --> H[Trier par proximité]
    H --> I[Afficher marqueurs sur carte]
    I --> J([Fin])
    D --> F
```

#### Séquence — Demander un rendez-vous

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express
    participant NS as NotificationService
    participant DB as MongoDB

    U->>R: Sélectionner centre + formulaire
    R->>API: POST /api/meetings (JWT)
    API->>DB: MeetingRequest.create()
    API->>NS: notifyCenter(meeting)
    NS->>DB: Notification.create()
    API-->>R: 201 { meeting }
    R-->>U: Confirmation demande
```

---

### Sprint 5 — Sécurité + Déploiement (Chapitre 7)

#### Classes (composants techniques)

```mermaid
classDiagram
  class AuthMiddleware {
    +verifyToken(req, res, next)
    +requireAdmin(req, res, next)
  }
  class TokenManager {
    +signAccessToken(payload)
    +createRefreshToken(userId)
    +rotateRefreshToken(token)
  }
  class ErrorHandler {
    +centralizedError(err, req, res, next)
  }
  AuthMiddleware --> TokenManager : utilise
```

#### Séquence — Authentification sécurisée (refresh)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant R as React
    participant API as Express
    participant TM as TokenManager
    participant DB as MongoDB

    R->>API: Requête API + Bearer accessToken
    alt Token expiré
        API-->>R: 401
        R->>API: POST /api/auth/refresh { refreshToken }
        API->>TM: rotateRefreshToken()
        TM->>DB: Vérifier + révoquer ancien token
        TM-->>API: nouveaux tokens
        API-->>R: 200 { accessToken, refreshToken }
        R->>API: Retry requête initiale
    else Token valide
        API-->>R: 200 données
    end
```

#### Séquence — Déploiement

```mermaid
sequenceDiagram
    actor A as Administrateur
    participant CI as Build / Deploy
    participant FE as Frontend (CDN/Static)
    participant BE as Backend (Node)
    participant Atlas as MongoDB Atlas

    A->>CI: npm run build (React)
    CI->>FE: Déployer fichiers statiques
    A->>CI: Déployer API Node.js
    CI->>BE: Variables .env production
    BE->>Atlas: Connexion MONGODB_URI
    Atlas-->>BE: Connexion OK
    BE-->>A: Application accessible en ligne
```

---

## 5. Architecture logicielle (Chapitre 2 — §2)

```mermaid
flowchart TB
    subgraph Client["Couche Présentation"]
        React[React.js Components]
        TF[TensorFlow.js]
        Leaf[Leaflet Map]
    end

    subgraph Serveur["Couche Contrôleur"]
        Routes[Routes Express]
        Ctrl[Controllers MVC]
        MW[Middleware auth]
        Svc[Services Points / Notifications]
    end

    subgraph Donnees["Couche Modèle"]
        Models[Mongoose Models]
        Mongo[(MongoDB)]
    end

    React --> Routes
    TF --> React
    Leaf --> React
    Routes --> MW --> Ctrl
    Ctrl --> Svc
    Ctrl --> Models
    Models --> Mongo
```

---

## 6. Architecture physique (Chapitre 2 — §2.3)

```mermaid
flowchart LR
    Browser[Navigateur Chrome]
    API[Serveur API REST Node.js]
    DB[(MongoDB Atlas)]
    CDN[CDN TensorFlow.js]
    OSM[OpenStreetMap Tiles]

    Browser -->|HTTPS JSON| API
    API -->|MongoDB Wire| DB
    Browser -->|HTTPS| CDN
    Browser -->|HTTPS| OSM
```

---

## 7. Tableau récapitulatif des figures du rapport

| Chapitre | Figure demandée | Section dans ce document |
|----------|-----------------|--------------------------|
| 2 | Diagramme de contexte | §2 |
| 2 | Architecture MVC / client-serveur | §5, §6 |
| 2 | Cas d'utilisation global | §3 |
| 3 | Classes auth | Sprint 1 — Classes |
| 3 | Séquence connexion | Sprint 1 — Séquence connecter |
| 3 | Séquence inscription | Sprint 1 — Séquence inscrire |
| 4 | Classes scan + points | Sprint 2 — Classes |
| 4 | Cas d'utilisation raffiné | Sprint 2 — CU |
| 4 | Activité scanner | Sprint 2 — Activité |
| 4 | Séquence scanner / historique | Sprint 2 — Séquences |
| 5 | Classes forum | Sprint 3 — Classes |
| 5 | Activité publication / commentaire | Sprint 3 — Activité |
| 5 | Séquences forum / leaderboard | Sprint 3 — Séquences |
| 6 | Classes géolocalisation | Sprint 4 — Classes |
| 6 | Activité recherche centres | Sprint 4 — Activité |
| 6 | Séquence RDV | Sprint 4 — Séquence |
| 7 | Classes sécurité | Sprint 5 — Classes |
| 7 | Séquence auth sécurisée / déploiement | Sprint 5 — Séquences |
| Global | **Diagramme de classes corrigé** | §1 |

---

## 8. Instructions draw.io (reproduire le diagramme de classes)

1. Créer **11 classes** : `User`, `RefreshToken`, `Admin`, `City`, `RecyclingCenter`, `Scan`, `PointsHistory`, `Post`, `Comment`, `MeetingRequest`, `Notification`.
2. Relier `City` 1 → * `RecyclingCenter` via `cityId`.
3. Relier avec associations (pas d'héritage User→Admin).
4. Cardinalités :
   - User `1` — `*` Scan  
   - User `1` — `*` PointsHistory  
   - User `1` — `*` Post, Comment, Notification, MeetingRequest  
   - Post `1` — `*` Comment  
   - Comment `0..1` — `*` Comment (réponses)  
   - City `1` — `*` RecyclingCenter  
   - RecyclingCenter `1` — `*` MeetingRequest  
   - Scan `0..1` — `0..1` PointsHistory  
5. Stéréotypes utiles : `<<enumeration>>` pour `status`, `type`, `reason`.

---

*Généré pour le rapport EcoScan Recycle — RUN-IT, stage 2026.*
