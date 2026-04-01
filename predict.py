import onnxruntime as ort
import numpy as np
import json
from PIL import Image
import os

class CropDiseasePredictor:
    def __init__(self):
        base = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base, 'models', 'crop_disease.onnx')
        class_path = os.path.join(base, 'models', 'class_names.json')

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"ONNX model not found at: {model_path}")
        if not os.path.exists(class_path):
            raise FileNotFoundError(f"class_names.json not found at: {class_path}")

        # ✅ FIXED INDENTATION HERE
        try:
            self.session = ort.InferenceSession(model_path)
            print("✅ ONNX model loaded successfully")
        except Exception as e:
            print("❌ Model load error:", e)
            raise e

        with open(class_path) as f:
            self.class_names = json.load(f)

        self.input_name = self.session.get_inputs()[0].name
        print(f"✅ Model loaded | Classes: {len(self.class_names)}")

    def preprocess(self, image_path):
        img = Image.open(image_path).convert('RGB')
        img = img.resize((224, 224), Image.LANCZOS)

        arr = np.array(img).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406])
        std  = np.array([0.229, 0.224, 0.225])

        arr = (arr - mean) / std
        arr = arr.transpose(2, 0, 1)
        arr = np.expand_dims(arr, axis=0)

        return arr.astype(np.float32)

    def predict(self, image_path):
        inp = self.preprocess(image_path)

        outputs = self.session.run(None, {self.input_name: inp})
        logits = outputs[0][0]

        probs = self._softmax(logits)
        top5_idx = np.argsort(probs)[::-1][:5]

        return {
            "predicted_class": self.class_names[top5_idx[0]],
            "confidence": float(probs[top5_idx[0]]),
            "top5": [
                {
                    "class": self.class_names[i],
                    "confidence": float(probs[i])
                }
                for i in top5_idx
            ]
        }

    @staticmethod
    def _softmax(x):
        e = np.exp(x - np.max(x))
        return e / e.sum()
