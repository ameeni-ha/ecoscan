#!/usr/bin/env python3
"""
Script pour entraîner un modèle de classification de déchets avec TensorFlow
et le convertir en format TensorFlow.js pour EcoScan.
"""

import os
import json
import shutil
import numpy as np
import tensorflow as tf

# Configuration
CLASS_NAMES = [
    "battery",
    "plastique",
    "bouteille_plastique",
    "cardboard",
    "clothes",
    "verre",
    "papier_carton",
    "metal",
    "electronique",
    "organique",
    "non_recyclable",
    "shoes",
    "trash"
]

IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 0.001
DATASET_PATH = "waste_dataset"
MODEL_OUTPUT_PATH = "public/models/waste-classifier"

def create_directory_structure():
    """Crée la structure des répertoires pour le dataset."""
    os.makedirs(DATASET_PATH, exist_ok=True)
    for class_name in CLASS_NAMES:
        class_path = os.path.join(DATASET_PATH, class_name)
        os.makedirs(class_path, exist_ok=True)
    print(f"✅ Structure des répertoires créée dans {DATASET_PATH}")

def download_sample_dataset():
    """
    Télécharge un dataset de déchets depuis Kaggle ou utilise des données de démonstration.
    Pour un vrai entraînement, vous devriez télécharger un dataset comme:
    - Waste Classification Data (Kaggle)
    - TACO (Trash Annotations in Context)
    - TrashNet
    """
    print("⚠️  Pour un entraînement réel, téléchargez un dataset de déchets")
    print("   Recommandé: Waste Classification Data de Kaggle")
    print("   URL: https://www.kaggle.com/datasets/asdasdasasdas/garbage-classification")
    print(f"\n📁 Placez vos images dans: {DATASET_PATH}/[classe]/")
    print("   Exemple: waste_dataset/plastique/image1.jpg")
    print("   Exemple: waste_dataset/verre/image2.jpg")
    print("\n🔄 Pour l'instant, le script utilisera des données synthétiques de démonstration")

def create_data_generators():
    """Crée les générateurs de données pour l'entraînement et la validation."""
    
    # Vérifier si le dataset existe
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset non trouvé dans {DATASET_PATH}. "
            "Téléchargez un dataset et organisez-le par classe."
        )
    
    # Vérifier si chaque classe a des images
    empty_classes = []
    for class_name in CLASS_NAMES:
        class_path = os.path.join(DATASET_PATH, class_name)
        if not os.path.exists(class_path) or len(os.listdir(class_path)) == 0:
            empty_classes.append(class_name)
    
    if empty_classes:
        print(f"⚠️  Classes sans images: {empty_classes}")
        print("   Le script continuera avec les classes disponibles")
    
    # Data augmentation pour l'entraînement
    train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest',
        validation_split=0.2
    )
    
    # Générateur d'entraînement
    train_generator = train_datagen.flow_from_directory(
        DATASET_PATH,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training',
        classes=CLASS_NAMES
    )
    
    # Générateur de validation
    validation_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        validation_split=0.2
    )
    
    validation_generator = validation_datagen.flow_from_directory(
        DATASET_PATH,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='validation',
        classes=CLASS_NAMES
    )
    
    print(f"✅ Images d'entraînement: {train_generator.samples}")
    print(f"✅ Images de validation: {validation_generator.samples}")
    
    return train_generator, validation_generator

def create_model():
    """Crée le modèle MobileNetV2 avec fine-tuning."""
    
    # Charger MobileNetV2 pré-entraîné (sans la couche finale)
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet'
    )
    
    # Geler les couches du modèle de base
    base_model.trainable = False
    
    # Ajouter des couches personnalisées
    model = tf.keras.models.Sequential([
        base_model,
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dense(256, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(len(CLASS_NAMES), activation='softmax')
    ])
    
    # Compiler le modèle
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    print("✅ Modèle MobileNetV2 créé")
    print(f"   Couches entraînables: {len(model.trainable_variables)}")
    
    return model, base_model

def train_model(model, train_generator, validation_generator):
    """Entraîne le modèle avec callbacks."""
    
    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            'best_model.keras',
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-7,
            verbose=1
        )
    ]
    
    print("🚀 Début de l'entraînement...")
    history = model.fit(
        train_generator,
        epochs=EPOCHS,
        validation_data=validation_generator,
        callbacks=callbacks,
        verbose=1
    )
    
    print("✅ Entraînement terminé")
    
    # Afficher les résultats
    final_train_acc = history.history['accuracy'][-1]
    final_val_acc = history.history['val_accuracy'][-1]
    print(f"📊 Accuracy entraînement: {final_train_acc:.4f}")
    print(f"📊 Accuracy validation: {final_val_acc:.4f}")
    
    return model, history

def fine_tune_model(model, base_model, train_generator, validation_generator):
    """Fine-tune du modèle (dégeler certaines couches)."""
    
    print("🔧 Fine-tuning du modèle...")
    
    # Dégeler les dernières couches de MobileNetV2
    base_model.trainable = True
    
    # Geler les premières couches (conserver les features générales)
    for layer in base_model.layers[:100]:
        layer.trainable = False
    
    # Recompiler avec un learning rate plus faible
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE / 10),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Continuer l'entraînement
    history_fine = model.fit(
        train_generator,
        epochs=20,
        validation_data=validation_generator,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=3, min_lr=1e-8)
        ],
        verbose=1
    )
    
    print("✅ Fine-tuning terminé")
    
    return model

def convert_to_tensorflowjs(model):
    """Convertit le modèle Keras en format TensorFlow.js."""
    
    print("🔄 Conversion en TensorFlow.js...")
    
    # Créer le répertoire de sortie
    os.makedirs(MODEL_OUTPUT_PATH, exist_ok=True)
    
    # Convertir le modèle
    tfjs.converters.save_keras_model(
        model,
        MODEL_OUTPUT_PATH,
        quantization_bytes=2  # Quantification pour réduire la taille
    )
    
    print(f"✅ Modèle converti et sauvegardé dans {MODEL_OUTPUT_PATH}")

def create_metadata():
    """Crée le fichier metadata.json pour TensorFlow.js."""
    
    metadata = {
        "modelSettings": {
            "inputSize": IMG_SIZE,
            "labels": CLASS_NAMES,
            "modelType": "image_classification"
        },
        "labels": CLASS_NAMES,
        "modelName": "EcoScan Waste Classifier",
        "modelVersion": "1.0",
        "framework": "tensorflow",
        "inputShape": [IMG_SIZE, IMG_SIZE, 3],
        "outputShape": [len(CLASS_NAMES)]
    }
    
    metadata_path = os.path.join(MODEL_OUTPUT_PATH, "metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    print(f"✅ metadata.json créé")

def create_classes_config():
    """Crée le fichier classes.json avec la configuration détaillée."""
    
    classes_config = {
        "classes": {
            "battery": {
                "label": "Pile / batterie",
                "material": "electronique",
                "recyclable": True,
                "reason": "Les piles et batteries doivent être déposées en point de collecte spécialisé."
            },
            "plastique": {
                "label": "Plastique",
                "material": "plastique",
                "recyclable": True,
                "reason": "Le modèle déchets a reconnu un objet en plastique recyclable."
            },
            "bouteille_plastique": {
                "label": "Bouteille plastique",
                "material": "plastique",
                "recyclable": True,
                "reason": "Les bouteilles PET/PEHD propres sont recyclables."
            },
            "cardboard": {
                "label": "Carton",
                "material": "papier_carton",
                "recyclable": True,
                "reason": "Le carton propre et sec est recyclable."
            },
            "clothes": {
                "label": "Vêtements",
                "material": "autre",
                "recyclable": False,
                "reason": "Les vêtements doivent être orientés vers don, réemploi ou collecte textile spécialisée."
            },
            "verre": {
                "label": "Verre",
                "material": "verre",
                "recyclable": True,
                "reason": "Le modèle déchets a reconnu un objet en verre recyclable."
            },
            "papier_carton": {
                "label": "Papier / carton",
                "material": "papier_carton",
                "recyclable": True,
                "reason": "Le modèle déchets a reconnu du papier ou carton recyclable."
            },
            "metal": {
                "label": "Métal",
                "material": "metal",
                "recyclable": True,
                "reason": "Le modèle déchets a reconnu un objet métallique recyclable."
            },
            "electronique": {
                "label": "Électronique",
                "material": "electronique",
                "recyclable": True,
                "reason": "Les appareils électroniques doivent être déposés en point spécialisé."
            },
            "organique": {
                "label": "Organique",
                "material": "organique",
                "recyclable": True,
                "reason": "Le modèle déchets a reconnu un déchet organique compostable."
            },
            "non_recyclable": {
                "label": "Non recyclable",
                "material": "autre",
                "recyclable": False,
                "reason": "Le modèle déchets a reconnu un objet non recyclable ou hors filière."
            },
            "shoes": {
                "label": "Chaussures",
                "material": "autre",
                "recyclable": False,
                "reason": "Les chaussures doivent être orientées vers don, réemploi ou collecte textile spécialisée."
            },
            "trash": {
                "label": "Déchet non recyclable",
                "material": "autre",
                "recyclable": False,
                "reason": "Le modèle déchets a reconnu un déchet à jeter ou à vérifier selon les consignes locales."
            }
        }
    }
    
    classes_path = os.path.join(MODEL_OUTPUT_PATH, "classes.json")
    with open(classes_path, 'w', encoding='utf-8') as f:
        json.dump(classes_config, f, indent=2, ensure_ascii=False)
    
    print(f"✅ classes.json créé")

def main():
    """Fonction principale."""
    
    print("=" * 60)
    print("🗑️  Entraînement du modèle EcoScan Waste Classifier")
    print("=" * 60)
    
    try:
        # Créer la structure des répertoires
        create_directory_structure()
        
        # Instructions pour le dataset
        download_sample_dataset()
        
        # Créer les générateurs de données
        train_generator, validation_generator = create_data_generators()
        
        # Créer le modèle
        model, base_model = create_model()
        
        # Entraîner le modèle
        model, history = train_model(model, train_generator, validation_generator)
        
        # Fine-tuning
        model = fine_tune_model(model, base_model, train_generator, validation_generator)
        
        # Sauvegarder le modèle en format Keras
        os.makedirs(MODEL_OUTPUT_PATH, exist_ok=True)
        model.save(os.path.join(MODEL_OUTPUT_PATH, "waste_classifier.keras"))
        print("✅ Modèle Keras sauvegardé")
        
        # Créer les fichiers de configuration
        create_metadata()
        create_classes_config()
        
        print("\n" + "=" * 60)
        print("⚠️  Conversion TensorFlow.js désactivée (conflit de dépendances)")
        print("💡 Pour convertir le modèle en TensorFlow.js, utilisez:")
        print("   python convert_to_tfjs.py")
        print("=" * 60)
        
        print("=" * 60)
        print("✅ Entraînement terminé avec succès !")
        print(f"📁 Modèle sauvegardé dans: {MODEL_OUTPUT_PATH}")
        print("=" * 60)
        
    except FileNotFoundError as e:
        print(f"❌ Erreur: {e}")
        print("\n📥 Instructions pour obtenir un dataset:")
        print("1. Téléchargez un dataset de déchets (ex: Waste Classification Data)")
        print("2. Organisez les images par classe dans waste_dataset/[classe]/")
        print("3. Relancez ce script")
        
    except Exception as e:
        print(f"❌ Erreur lors de l'entraînement: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
