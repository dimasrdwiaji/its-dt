import os
if "PROJ_LIB" not in os.environ:
    os.environ['PROJ_LIB'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\proj'
if "GDAL_DATA" not in os.environ:
    os.environ['GDAL_DATA'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\gdal'
os.environ['PATH'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\bin;' + os.environ.get('PATH', '')

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import rasterio
import json
import numpy as np

from contextlib import asynccontextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
MODEL_PATH = os.path.join(DATA_DIR, "ITS_LST_RandomForest_Oct.joblib")
RULES_PATH = os.path.join(DATA_DIR, "intervention_rules.json")
PREDICTORS_TIFF = os.path.join(DATA_DIR, "ITS_LST_Predictors_10m_Oct.tif")
BUILDINGS_GEOJSON = os.path.join(DATA_DIR, "buildings_wgs84.geojson")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global RF_MODEL, RULES
    
    # Load Random Forest Model
    if os.path.exists(MODEL_PATH):
        RF_MODEL = joblib.load(MODEL_PATH)
        print("Random Forest model loaded successfully from", MODEL_PATH)
    else:
        print(f"Warning: Model not found at {MODEL_PATH}")

    # Load Intervention Rules
    if os.path.exists(RULES_PATH):
        with open(RULES_PATH, 'r') as f:
            RULES = json.load(f)
        print("Intervention rules loaded successfully from", RULES_PATH)
    else:
        print(f"Warning: Rules not found at {RULES_PATH}")
        
    yield
    
    # Cleanup on shutdown
    RF_MODEL = None
    RULES = None

# Initialize FastAPI
app = FastAPI(title="ITS Digital Twin API", lifespan=lifespan)

# Allow CORS for Vue frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to hold data in memory
RF_MODEL = None
RULES = None

# Define predictor order as trained
PREDICTOR_NAMES = [
    "B2", "B3", "B4", "B8", "B11", "B12", 
    "NDMI", "NBR", "NBR2", "NDWI", "MNDWI", "MNDWI2", 
    "elevation", "TPI", "slope", 
    "wetness", "greeness", "dryness"
]

class InterventionRequest(BaseModel):
    lat: float
    lon: float
    intervention_id: str

@app.post("/api/ecology/predict")
def predict_ecology(req: InterventionRequest):
    if not RF_MODEL or not RULES:
        raise HTTPException(status_code=500, detail="Backend resources not loaded")

    # 1. Find the intervention rule
    intervention = None
    for tree in RULES['ecology']['trees']:
        if tree['id'] == req.intervention_id:
            intervention = tree
            break
            
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention ID not found")

    # 2. Extract baseline pixel values from the Raster
    try:
        with rasterio.open(PREDICTORS_TIFF) as src:
            if not (src.bounds.left <= req.lon <= src.bounds.right and src.bounds.bottom <= req.lat <= src.bounds.top):
                raise HTTPException(status_code=400, detail="Coordinate is outside campus study area bounds.")
            coords = [(req.lon, req.lat)]
            sampled = list(src.sample(coords))[0] # Get the 18 band values
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Raster sampling failed: {str(e)}")

    if len(sampled) != len(PREDICTOR_NAMES):
        raise HTTPException(status_code=500, detail="Raster bands do not match predictor count")

    # Convert to dictionary for easy manipulation
    features = {name: float(val) for name, val in zip(PREDICTOR_NAMES, sampled)}
    
    # Predict baseline LST
    baseline_array = np.array([features[name] for name in PREDICTOR_NAMES]).reshape(1, -1)
    baseline_lst = float(RF_MODEL.predict(baseline_array)[0])

    # 3. Apply Intervention Deltas
    rf_deltas = intervention.get('rf_deltas', {})
    for key, delta in rf_deltas.items():
        if key in features:
            features[key] += delta

    # Predict new LST
    new_array = np.array([features[name] for name in PREDICTOR_NAMES]).reshape(1, -1)
    new_lst = float(RF_MODEL.predict(new_array)[0])

    return {
        "baseline_lst_c": round(baseline_lst, 2),
        "new_lst_c": round(new_lst, 2),
        "delta_c": round(new_lst - baseline_lst, 2),
        "intervention": intervention['name'],
        "canopy_radius_m": intervention.get('canopy_radius_m', 6),
        "cost_idr": intervention.get('cost_idr', 150000),
        "co2_mitigation_kg_yr": intervention.get('co2_mitigation_kg_yr', 15.0)
    }

@app.get("/api/buildings")
def get_buildings():
    """Serves the lightweight WGS84 GeoJSON for the frontend Cesium map"""
    if os.path.exists(BUILDINGS_GEOJSON):
        with open(BUILDINGS_GEOJSON, 'r') as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Buildings file not found")

@app.get("/api/catalog")
def get_catalog():
    """Serves the intervention rules to populate the Vue UI"""
    return RULES
