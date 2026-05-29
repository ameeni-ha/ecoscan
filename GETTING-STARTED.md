# 🚀 Guide de Démarrage - 4 Mois Sprint Plan

> Comment commencer à exécuter votre plan de 4 mois

---

## 📋 Avant de Commencer

### Vérifier les Prérequis
```bash
# Vérifier Node.js
node --version  # Doit être v18+

# Vérifier npm
npm --version   # Doit être v9+

# Vérifier MongoDB (local)
mongod --version
# OU utiliser MongoDB Atlas (cloud)
```

### Setup Initial
```bash
# Backend
cd backend/api
npm install

# Frontend
cd src/
npm install

# Verify project structure
ls -la ../
```

### Configuration .env
```bash
# backend/api/.env
MONGO_URI=mongodb://localhost:27017/ecoscan
ACCESS_TOKEN_SECRET=your_access_token_secret_key
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key
PORT=4000
NODE_ENV=development
```

---

## 📅 Sprints à Venir

### Sprint 1 (Semaines 1-2) 🔐 Fondations
**Start Date:** [À définir]

**Checklist Rapide:**
- [ ] Express server démarre
- [ ] MongoDB connecté
- [ ] JWT auth fonctionne
- [ ] React routing setup
- [ ] Connexion/Inscription pages

**Quick Test:**
```bash
# Terminal 1: API
npm run api
curl http://localhost:4000/api/health

# Terminal 2: Frontend
npm start
# Visit http://localhost:3000
```

---

### Sprint 2 (Semaines 3-4) 👤 Profils
**Dépend de:** Sprint 1 ✅

**Focus:** User profiles + All models

---

### Sprint 3 (Semaines 5-6) 📸 Scanning
**Dépend de:** Sprint 2 ✅

**Focus:** TensorFlow.js + camera streaming

---

### Sprint 4 (Semaines 7-8) 📤 Upload
**Dépend de:** Sprint 3 ✅

**Focus:** File upload + Points system

---

### Sprint 5 (Semaines 9-10) 💬 Forum
**Dépend de:** Sprint 2 ✅

**Focus:** Posts + Images

---

### Sprint 6 (Semaines 11-12) 🎭 Comments
**Dépend de:** Sprint 5 ✅

**Focus:** Comments + Moderation + Leaderboard

---

### Sprint 7 (Semaines 13-14) 🗺️ Géolocation
**Dépend de:** Sprint 2 ✅

**Focus:** Leaflet Map + Centres + Nearby search

---

### Sprint 8 (Semaines 15-16) 🚀 Deploy
**Dépend de:** Tous les sprints ✅

**Focus:** Meetings + Testing + Production deployment

---

## 📊 Progress Tracker

```
Sprint 1: [░░░░░░░░░░] 0%
Sprint 2: [░░░░░░░░░░] 0%
Sprint 3: [░░░░░░░░░░] 0%
Sprint 4: [░░░░░░░░░░] 0%
Sprint 5: [░░░░░░░░░░] 0%
Sprint 6: [░░░░░░░░░░] 0%
Sprint 7: [░░░░░░░░░░] 0%
Sprint 8: [░░░░░░░░░░] 0%
─────────────────────────
Total:   [░░░░░░░░░░] 0%
```

---

## 🎯 Next Steps

1. **Confirmer la date de démarrage** → Mettre à jour les "Start Date"
2. **Former l'équipe** → Revoir SPRINT-PLANNING-4MOIS.md
3. **Setup l'environnement** → Suivre section "Configuration .env"
4. **Commencer Sprint 1** → Lire SPRINT-PLANNING-4MOIS.md section Sprint 1
5. **Track le progress** → Mettre à jour SPRINT-TRACKER.md chaque jour

---

## 📚 Documents de Référence

| Document | Purpose |
|----------|---------|
| SPRINT-PLANNING-4MOIS.md | Plan complet (ce document) |
| TECH-STACK.md | Technologies utilisées |
| MVC-ARCHITECTURE.md | Architecture backend |
| README.md | Setup & run instructions |

---

## 💬 Daily Standups

**Format recommandé (15 min):**
1. ✅ Qu'ai-je fait hier?
2. 🎯 Que vais-je faire aujourd'hui?
3. 🚨 Bloquants/problèmes?

**Tracking:**
- Update status in SPRINT-TRACKER.md daily
- Log blockers immediately
- Escalate if needed

---

## 🚨 Emergency Contacts

- **Backend Issue:** Check console for errors
- **Database Down:** Verify MongoDB service
- **Deployment Failed:** Check git logs + error messages
- **Performance Slow:** Monitor API response times

---

## ✅ You're Ready!

Start with **Sprint 1** by reading the full details in **SPRINT-PLANNING-4MOIS.md**

Good luck! 🚀

---

**Last Updated:** 22 Mai 2026
**Next Review:** End of Sprint 1
