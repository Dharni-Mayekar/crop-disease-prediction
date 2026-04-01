from flask import Flask, request, jsonify
from flask_cors import CORS
import os, uuid
from predict import CropDiseasePredictor
from disease_info import get_disease_info, RISK_CONFIG

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB

predictor = CropDiseasePredictor()

ALLOWED = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}

def allowed(fname):
    return '.' in fname and fname.rsplit('.', 1)[1].lower() in ALLOWED

# Marathi class name map for top-5 predictions
CLASS_NAME_MR = {
    "Tomato_Bacterial_spot":                        "टोमॅटो - जिवाणू डाग",
    "Tomato_Early_blight":                          "टोमॅटो - प्रारंभिक करपा",
    "Tomato_Late_blight":                           "टोमॅटो - उशीरा करपा",
    "Tomato_Leaf_Mold":                             "टोमॅटो - पानाची बुरशी",
    "Tomato_Septoria_leaf_spot":                    "टोमॅटो - सेप्टोरिया पान डाग",
    "Tomato_Spider_mites_Two_spotted_spider_mite":  "टोमॅटो - कोळी माइट",
    "Tomato_Target_Spot":                           "टोमॅटो - लक्ष्य डाग",
    "Tomato_Tomato_Yellow_Leaf_Curl_Virus":         "टोमॅटो - पिवळे पान कुरळे विषाणू",
    "Tomato_Tomato_mosaic_virus":                   "टोमॅटो - मोझेक विषाणू",
    "Tomato_healthy":                               "टोमॅटो - निरोगी",
    "Potato___Early_Blight":                        "बटाटा - प्रारंभिक करपा",
    "Potato___Late_Blight":                         "बटाटा - उशीरा करपा",
    "Potato___healthy":                             "बटाटा - निरोगी",
}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'classes': len(predictor.class_names)})

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    if not file.filename or not allowed(file.filename):
        return jsonify({'error': 'Invalid file type. Use JPG, PNG, WEBP or BMP.'}), 400

    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        result   = predictor.predict(filepath)
        cls_name = result['predicted_class']
        info     = get_disease_info(cls_name)
        risk_cfg = RISK_CONFIG.get(info['risk'], RISK_CONFIG['MODERATE'])

        # Enrich top-5 with Marathi class names
        top5_enriched = []
        for item in result['top5']:
            top5_enriched.append({
                "class":      item['class'],
                "class_mr":   CLASS_NAME_MR.get(item['class'], item['class'].replace('_', ' ')),
                "confidence": item['confidence'],
            })

        response = {
            'success': True,
            'predicted_class': cls_name,
            'confidence': round(result['confidence'] * 100, 2),
            'disease': {
                'display_name':    info['display'],
                'display_name_mr': info.get('display_mr', info['display']),
                'crop':            info['crop'],
                'crop_mr':         info.get('crop_mr', info['crop']),
                'description':     info['description'],
                'description_mr':  info.get('description_mr', info['description']),
                'treatment':       info['treatment'],
                'treatment_mr':    info.get('treatment_mr', info['treatment']),
            },
            'risk': {
                'level':  info['risk'],
                'label':  risk_cfg['label'],
                'color':  risk_cfg['color'],
                'bg':     risk_cfg['bg'],
                'emoji':  risk_cfg['emoji'],
            },
            'top5': top5_enriched,
        }
        return jsonify(response)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

if __name__ == '__main__':
    print("🌿 Starting Crop Disease Detector API...")
    app.run(debug=True, port=5000)