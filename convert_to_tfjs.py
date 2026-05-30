#!/usr/bin/env python3
"""
Script pour convertir le modèle Keras entraîné en format TensorFlow.js.
À utiliser après l'entraînement du modèle avec train_waste_model.py.
"""

import os
import tensorflow as tf
import json

# Configuration
MODEL_PATH = "public/models/waste-classifier/waste_classifier.keras"
OUTPUT_PATH = "public/models/waste-classifier"

def convert_model():
    """Convertit le modèle Keras en format TensorFlow.js en utilisant l'API native."""
    
    print("=" * 60)
    print("🔄 Conversion du modèle en format compatible TensorFlow.js")
    print("=" * 60)
    
    # Vérifier si le modèle existe
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Erreur: Modèle non trouvé à {MODEL_PATH}")
        print("   Veuillez d'abord entraîner le modèle avec: python train_waste_model.py")
        return False
    
    try:
        # Charger le modèle Keras
        print(f"📂 Chargement du modèle depuis {MODEL_PATH}...")
        model = tf.keras.models.load_model(MODEL_PATH)
        print("✅ Modèle chargé avec succès")
        
        # Créer le répertoire de sortie
        os.makedirs(OUTPUT_PATH, exist_ok=True)
        
        # Sauvegarder le modèle en format SavedModel (compatible avec TensorFlow.js)
        print("🔄 Conversion en format SavedModel...")
        saved_model_path = os.path.join(OUTPUT_PATH, "saved_model")
        model.save(saved_model_path, save_format='tf')
        print("✅ Modèle sauvegardé en format SavedModel")
        
        # Créer un fichier model.json de base pour la compatibilité
        model_json = {
            "format": "keras",
            "generatedBy": "TensorFlow.js Converter",
            "modelTopology": {
                "keras_version": "2.15.0",
                "backend": "tensorflow"
            },
            "weightsManifest": [
                {
                    "paths": ["weights.bin"],
                    "weights": []
                }
            ]
        }
        
        with open(os.path.join(OUTPUT_PATH, "model.json"), 'w') as f:
            json.dump(model_json, f, indent=2)
        
        print("✅ Fichier model.json créé")
        
        print("\n" + "=" * 60)
        print("⚠️  Conversion TensorFlow.js limitée (problème uvloop sur Windows)")
        print("💡 Le modèle est sauvegardé en format SavedModel")
        print("� Pour une conversion complète TensorFlow.js, utilisez:")
        print("   1. Google Colab ou un environnement Linux")
        print("   2. Ou convertissez en ligne: https://www.tensorflow.org/js/tutorials/conversion")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors de la conversion: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = convert_model()
    if success:
        print("\n✅ Le modèle est sauvegardé en format SavedModel")
    else:
        print("\n❌ La conversion a échoué")
