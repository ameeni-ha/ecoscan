# 📡 API Reference - EcoScan Backend

## Base URL
```
http://localhost:4000
```

## 🔑 Authentication

Tous les endpoints protégés nécessitent un token JWT dans le header:
```
Authorization: Bearer <access_token>
```

---

## 🏥 Health Check

### GET /api/health
Vérifier que le serveur est opérationnel.

**Response:**
```json
{ "status": "ok" }
```

---

## 🔐 Authentication (`/api/auth`)

### POST /api/auth/register
Créer un nouvel utilisateur.

**Body:**
```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@example.com",
  "password": "password123",
  "accountType": "collecteur",
  "phone": "0612345678",
  "address": "123 Rue de la Paix"
}
```

**Response (201):**
```json
{
  "message": "Inscription reussie",
  "token": "eyJhbGc...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "Jean",
    "email": "jean@example.com",
    "role": "client",
    "points": 0
  }
}
```

---

### POST /api/auth/login
Se connecter.

**Body:**
```json
{
  "email": "jean@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Connexion reussie",
  "token": "eyJhbGc...",
  "user": { /* user object */ }
}
```

---

### POST /api/auth/refresh
Rafraîchir le access token.

**Response (200):**
```json
{
  "message": "Session rafraichie",
  "token": "eyJhbGc..."
}
```

---

### POST /api/auth/logout
Se déconnecter (requiert cookie refresh token).

**Response (204):** No content

---

---

## 👤 Users (`/api/users`) - Protected

### GET /api/users/me
Récupérer le profil actuel.

**Response (200):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "phone": "0612345678",
    "points": 145,
    "createdAt": "2024-05-14T10:30:00Z"
  }
}
```

---

### PATCH /api/users/me
Mettre à jour le profil.

**Body (optionnel):**
```json
{
  "firstName": "Jean-Pierre",
  "lastName": "Dupont",
  "phone": "0612345679",
  "address": "456 Rue de la Paix",
  "password": "newPassword123"
}
```

**Response (200):**
```json
{
  "user": { /* updated user */ }
}
```

---

### POST /api/users/logout-all
Se déconnecter de tous les appareils.

**Response (204):** No content

---

---

## 💬 Forum (`/api/forum`) - Protected

### GET /api/forum/posts
Lister tous les posts.

**Query params:**
- Aucun

**Response (200):**
```json
{
  "posts": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "Comment recycler le plastique?",
      "content": "Voici quelques astuces...",
      "tags": ["plastique", "recyclage"],
      "images": [],
      "status": "published",
      "author": {
        "id": "507f1f77bcf86cd799439012",
        "firstName": "Jean",
        "lastName": "Dupont",
        "accountType": "collecteur"
      },
      "excerpt": "Voici quelques astuces...",
      "createdAt": "2024-05-14T10:30:00Z"
    }
  ]
}
```

---

### POST /api/forum/posts
Créer un nouveau post (multipart avec photos).

**Body (multipart/form-data):**
- `title` (string) - Titre du post
- `content` (string) - Contenu
- `tags` (string) - Tags séparés par virgule
- `photos` (file[]) - Photos optionnelles (max 6)

**Response (201):**
```json
{
  "postId": "507f1f77bcf86cd799439011"
}
```

---

### GET /api/forum/posts/:id
Récupérer un post avec ses commentaires.

**Response (200):**
```json
{
  "post": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Comment recycler le plastique?",
    /* ... */
  },
  "comments": [
    {
      "id": "507f1f77bcf86cd799439020",
      "content": "Bonne astuce!",
      "author": { /* user */ },
      "createdAt": "2024-05-14T11:30:00Z"
    }
  ]
}
```

---

### PUT /api/forum/posts/:id
Modifier un post (auteur uniquement).

**Body:**
```json
{
  "title": "Titre modifié",
  "content": "Contenu modifié",
  "tags": "tag1,tag2"
}
```

**Response (200):**
```json
{
  "message": "Post modifié",
  "postId": "507f1f77bcf86cd799439011"
}
```

---

### DELETE /api/forum/posts/:id
Supprimer un post (auteur uniquement).

**Response (200):**
```json
{
  "message": "Post supprimé"
}
```

---

### POST /api/forum/posts/:id/comments
Ajouter un commentaire (collecteurs + modérateurs uniquement).

**Body:**
```json
{
  "content": "Bonne astuce!",
  "parentCommentId": "507f1f77bcf86cd799439020"
}
```

**Response (201):**
```json
{
  "commentId": "507f1f77bcf86cd799439021"
}
```

---

### PUT /api/forum/posts/:id/comments/:commentId
Modifier un commentaire (auteur uniquement).

**Body:**
```json
{
  "content": "Contenu modifié"
}
```

**Response (200):**
```json
{
  "message": "Commentaire modifié",
  "commentId": "507f1f77bcf86cd799439021"
}
```

---

### DELETE /api/forum/posts/:id/comments/:commentId
Supprimer un commentaire (auteur uniquement).

**Response (200):**
```json
{
  "message": "Commentaire supprimé"
}
```

---

---

## ♻️ Recycling Centers (`/api/centers`) - Public

### GET /api/centers
Lister tous les centres de recyclage.

**Query params:**
- `city` (string) - Filtrer par ville
- `material` (string) - Filtrer par matériau
- `includeUnverified` (boolean) - Inclure les non vérifiés

**Response (200):**
```json
{
  "centers": [
    {
      "id": "507f1f77bcf86cd799439011",
      "centerName": "Centre de Dakar",
      "city": "Dakar",
      "phone": "+221 33 123 4567",
      "materialsAccepted": ["plastic", "glass"],
      "latitude": 14.7167,
      "longitude": -17.4674,
      "rating": 4.5
    }
  ],
  "count": 1
}
```

---

### GET /api/centers/nearby
Centres à proximité (triés par distance).

**Query params:**
- `lat` (number) - Latitude **[Requis]**
- `lng` (number) - Longitude **[Requis]**
- `limit` (number) - Nombre de résultats (max 25)
- `material` (string) - Filtrer par matériau

**Response (200):**
```json
{
  "centers": [
    {
      "id": "507f1f77bcf86cd799439011",
      "centerName": "Centre de Dakar",
      "distanceKm": 2.5,
      /* ... */
    }
  ]
}
```

---

### GET /api/osm-recycling-centers
Centres depuis OpenStreetMap.

**Query params:**
- `country` (string) - Pays (défaut: Tunisia)
- `limit` (number) - Limite de résultats

**Response (200):**
```json
{
  "centers": [ /* ... */ ],
  "count": 15,
  "source": "openstreetmap"
}
```

---

---

## 📸 Scans (`/api/scans`) - Protected

### POST /api/scans
Créer un scan (collecteurs uniquement).

**Body (multipart/form-data):**
- `label` (string) - Nom de l'objet
- `material` (string) - Matériau (plastique, verre, papier_carton, metal, electronique, organique)
- `photo` (file) - Photo optionnelle

**Response (201):**
```json
{
  "message": "Scan créé avec succès",
  "scan": {
    "id": "507f1f77bcf86cd799439011",
    "label": "Bouteille plastique",
    "material": "plastique",
    "recyclable": true,
    "points": 5,
    "instructions": "Rincez et videz..."
  },
  "userPoints": 150
}
```

---

### GET /api/scans/:id
Récupérer un scan.

**Response (200):**
```json
{
  "scan": { /* scan object */ }
}
```

---

### GET /api/scans/my
Lister mes scans.

**Response (200):**
```json
{
  "scans": [ /* array of scan objects */ ]
}
```

---

---

## 📅 Meetings (`/api/meetings`) - Protected

### POST /api/meetings
Créer une demande de réunion.

**Body:**
```json
{
  "centerUserId": "507f1f77bcf86cd799439011",
  "preferredDate": "2024-05-20T14:00:00Z",
  "message": "Intéressé pour une collaboration"
}
```

**Response (201):**
```json
{
  "meetingId": "507f1f77bcf86cd799439011"
}
```

---

### GET /api/meetings/my
Mes demandes de réunion.

**Response (200):**
```json
{
  "meetings": [
    {
      "id": "507f1f77bcf86cd799439011",
      "status": "pending",
      "message": "Intéressé pour une collaboration",
      "preferredDate": "2024-05-20T14:00:00Z",
      "center": {
        "id": "507f1f77bcf86cd799439012",
        "centerName": "Centre de Dakar"
      }
    }
  ]
}
```

---

### GET /api/meetings/inbox
Boîte de réception des demandes.

**Response (200):**
```json
{
  "meetings": [
    {
      "id": "507f1f77bcf86cd799439011",
      "status": "pending",
      "requester": {
        "id": "507f1f77bcf86cd799439012",
        "firstName": "Jean",
        "email": "jean@example.com"
      }
    }
  ]
}
```

---

---

## 👨‍💼 Admin Routes (`/api/admin`) - Admin Only

### GET /api/admin/centers
Lister tous les centres avec stats.

**Response (200):**
```json
{
  "centers": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Centre de Dakar",
      "verified": true,
      "rating": 4.5
    }
  ]
}
```

---

### GET /api/admin/posts
Lister tous les posts avec stats.

**Response (200):**
```json
{
  "posts": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "Post title",
      "status": "published",
      "commentCount": 5
    }
  ]
}
```

---

### GET /api/admin/scans
Lister tous les scans avec stats.

**Response (200):**
```json
{
  "scans": [ /* array */ ]
}
```

---

### GET /api/admin/stats
Statistiques globales.

**Response (200):**
```json
{
  "stats": {
    "totalUsers": 150,
    "totalCenters": 25,
    "totalPosts": 342,
    "totalScans": 1250,
    "totalPoints": 6250
  }
}
```

---

### PATCH /api/admin/posts/:id/status
Modifier le statut d'un post.

**Body:**
```json
{
  "status": "hidden"
}
```

**Response (200):**
```json
{
  "message": "Post masqué"
}
```

---

### DELETE /api/admin/centers/:id
Supprimer un centre.

**Response (200):**
```json
{
  "message": "Centre supprimé"
}
```

---

## 🔴 Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Succès |
| 201 | Created - Ressource créée |
| 204 | No Content - Succès sans contenu |
| 400 | Bad Request - Requête invalide |
| 401 | Unauthorized - Authentification requise |
| 403 | Forbidden - Accès refusé |
| 404 | Not Found - Ressource non trouvée |
| 500 | Internal Server Error - Erreur serveur |
| 503 | Service Unavailable - Base de données indisponible |

---

**Dernière mise à jour:** 2026-05-14
