# Entraînement du modèle EcoScan Waste Classifier

Ce guide explique comment entraîner un modèle de classification de déchets personnalisé pour EcoScan en utilisant un dataset et TensorFlow.

## Prérequis

- Python 3.8 ou supérieur
- pip (gestionnaire de paquets Python)
- GPU (optionnel, recommandé pour un entraînement plus rapide)

## Installation des dépendances

```bash
pip install -r requirements.txt
```

## Structure des fichiers

```
ecoscan/
├── train_waste_model.py          # Script d'entraînement principal
├── requirements.txt               # Dépendances Python
├── waste_dataset/                # Dataset d'images (à créer)
│   ├── plastique/
│   ├── bouteille_plastique/
│   ├── battery/
│   ├── cardboard/
│   ├── clothes/
│   ├── verre/
│   ├── papier_carton/
│   ├── metal/
│   ├── electronique/
│   ├── organique/
│   ├── non_recyclable/
│   ├── shoes/
│   └── trash/
└── public/models/waste-classifier/  # Modèle entraîné (généré)
    ├── model.json
    ├── weights.bin
    ├── metadata.json
    └── classes.json
```

## Obtention d'un dataset

### Option 1: Dataset Kaggle (Recommandé)

1. **Créer un compte Kaggle** : https://www.kaggle.com/
2. **Télécharger le dataset** :
   - Waste Classification Data: https://www.kaggle.com/datasets/asdasdasasdas/garbage-classification
   - Ou TACO: https://github.com/pedropro/TACO

3. **Organiser les images** :
   ```bash
   waste_dataset/
   ├── plastique/
   │   ├── image1.jpg
   │   ├── image2.jpg
   │   └── ...
   ├── verre/
   │   ├── image1.jpg
   │   └── ...
   └── ...
   ```

### Option 2: Dataset personnalisé

Collectez vos propres images et organisez-les par classe dans le dossier `waste_dataset/`.

**Recommandations pour chaque classe :**
- Minimum 50 images par classe
- Idéalement 200-500 images par classe pour une bonne précision
- Images variées (différents angles, lumières, arrière-plans)
- Format: JPG, PNG

## Classes du modèle

Le modèle est entraîné pour classifier 13 types de déchets :

1. **battery** - Piles et batteries (point spécialisé)
2. **plastique** - Objets en plastique généraux
3. **bouteille_plastique** - Bouteilles et flacons en plastique
4. **cardboard** - Carton
5. **clothes** - Vêtements / textile
6. **verre** - Objets en verre (bouteilles, bocaux)
7. **papier_carton** - Papier et carton
8. **metal** - Métaux (canettes, boîtes)
9. **electronique** - Appareils électroniques
10. **organique** - Déchets organiques et alimentaires
11. **non_recyclable** - Objets non recyclables
12. **shoes** - Chaussures
13. **trash** - Déchets génériques

## Entraînement du modèle

### Étape 1: Préparer le dataset

```bash
# Créer la structure des dossiers
python -c "import os; [os.makedirs(f'waste_dataset/{c}', exist_ok=True) for c in ['battery', 'plastique', 'bouteille_plastique', 'cardboard', 'clothes', 'verre', 'papier_carton', 'metal', 'electronique', 'organique', 'non_recyclable', 'shoes', 'trash']]"

# Placez vos images dans les dossiers correspondants
```

### Étape 2: Lancer l'entraînement

```bash
python train_waste_model.py
```

### Étape 3: Paramètres d'entraînement

Le script utilise les paramètres suivants (modifiables dans `train_waste_model.py`) :

- **Taille d'image**: 224x224 pixels
- **Batch size**: 32
- **Époques**: 50 (avec early stopping)
- **Learning rate**: 0.001
- **Modèle de base**: MobileNetV2 (pré-entraîné sur ImageNet)
- **Fine-tuning**: Dégel des dernières couches de MobileNetV2

### Étape 4: Suivi de l'entraînement

Le script affiche :
- Accuracy d'entraînement et validation
- Loss d'entraînement et validation
- Callbacks pour early stopping et réduction du learning rate

## Résultat

Après l'entraînement, le modèle sera sauvegardé dans `public/models/waste-classifier/` :

- **model.json** - Structure du modèle TensorFlow.js
- **weights.bin** - Poids entraînés du modèle
- **metadata.json** - Métadonnées du modèle
- **classes.json** - Configuration des classes

## Utilisation dans EcoScan

Une fois le modèle entraîné, le code JavaScript de EcoScan utilisera automatiquement ce modèle personnalisé au lieu du fallback COCO-SSD.

Le système détectera automatiquement si le modèle personnalisé est disponible et l'utilisera pour une classification plus précise des déchets.

## Dépannage

### Erreur: Dataset non trouvé

**Solution**: Assurez-vous que le dossier `waste_dataset/` existe et contient des images dans chaque sous-dossier de classe.

### Erreur: Mémoire insuffisante

**Solution**: 
- Réduisez le `BATCH_SIZE` dans le script
- Utilisez un GPU si disponible
- Réduisez la taille des images

### Précision insuffisante

**Solution**:
- Ajoutez plus d'images par classe
- Assurez-vous que les images sont de bonne qualité
- Augmentez le nombre d'époques
- Utilisez un dataset plus varié

## Améliorations possibles

1. **Data augmentation** : Le script utilise déjà l'augmentation de données
2. **Transfer learning** : MobileNetV2 est utilisé comme base
3. **Ensemble learning** : Combiner plusieurs modèles
4. **Hyperparameter tuning** : Optimiser les hyperparamètres

## Ressources

- [TensorFlow.js](https://www.tensorflow.org/js)
- [MobileNetV2](https://arxiv.org/abs/1801.04381)
- [Kaggle Datasets](https://www.kaggle.com/datasets)
- [Teachable Machine](https://teachablemachine.withgoogle.com/)

## Support

Pour toute question sur l'entraînement du modèle, consultez la documentation TensorFlow ou ouvrez une issue sur le projet.
