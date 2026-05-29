# Diagrammes PlantUML — EcoScan Recycle

Fichier principal : **`ecoscan-uml.puml`**

## Prévisualiser / exporter

### Option 1 — VS Code / Cursor (recommandé)
1. Installer l’extension **PlantUML** (jebbs.plantuml)
2. Ouvrir `ecoscan-uml.puml`
3. `Alt+D` : aperçu | `Ctrl+Shift+P` → `PlantUML: Export Current Diagram`

### Option 2 — En ligne
1. Aller sur https://www.plantuml.com/plantuml/uml/
2. Copier un bloc `@startuml` … `@enduml`
3. Exporter en PNG ou SVG

### Option 3 — CLI (si Java installé)
```bash
java -jar plantuml.jar diagrams/ecoscan-uml.puml
```

## Liste des diagrammes

| Nom `@startuml` | Chapitre | Type |
|-----------------|----------|------|
| `classe-global` | 2 / Global | Classes |
| `contexte` | 2 | Contexte |
| `cas-utilisation-global` | 2 | Cas d’utilisation |
| `architecture-mvc` | 2 | Composants |
| `architecture-physique` | 2 | Déploiement |
| `sprint1-classes` | 3 | Classes |
| `seq-inscription` | 3 | Séquence |
| `seq-connexion` | 3 | Séquence |
| `sprint2-classes` | 4 | Classes |
| `sprint2-cu` | 4 | Cas d’utilisation |
| `activite-scanner` | 4 | Activité |
| `seq-scanner` | 4 | Séquence |
| `seq-historique-scans` | 4 | Séquence |
| `sprint3-classes` | 5 | Classes |
| `sprint3-cu` | 5 | **CU raffiné** |
| `activite-publication` | 5 | Activité |
| `activite-commentaire` | 5 | **Activité commentaire** |
| `seq-publication` | 5 | Séquence |
| `seq-commentaire` | 5 | **Séquence commentaire** |
| `seq-leaderboard` | 5 | Séquence |
| `sprint4-classes` | 6 | Classes |
| `sprint4-cu` | 6 | **CU raffiné** |
| `activite-centres-proches` | 6 | Activité |
| `activite-rendez-vous` | 6 | **Activité RDV** |
| `seq-centres-proches` | 6 | **Séquence centres proches** |
| `seq-rendez-vous` | 6 | Séquence |
| `sprint5-cu` | 7 | **CU raffiné** |
| `sprint5-classes` | 7 | Classes |
| `seq-auth-securisee` | 7 | Séquence |
| `seq-deploiement` | 7 | Séquence |

Pour exporter **une seule** figure : placez le curseur dans le bloc concerné avant d’exporter.
