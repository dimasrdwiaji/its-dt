import os
import sys

# Configure Proj and GDAL paths portably across environments (Conda, venv, or system)
conda_prefix = os.environ.get("CONDA_PREFIX") or os.environ.get("VIRTUAL_ENV")
fallback_conda = r"C:\Users\Dimas RD\miniconda3\envs\geo_env"
target_prefix = conda_prefix if (conda_prefix and os.path.exists(conda_prefix)) else fallback_conda

if target_prefix and os.path.exists(target_prefix):
    is_win = os.name == 'nt'
    lib_bin = os.path.join(target_prefix, "Library", "bin") if is_win else os.path.join(target_prefix, "bin")
    proj_share = os.path.join(target_prefix, "Library", "share", "proj") if is_win else os.path.join(target_prefix, "share", "proj")
    gdal_share = os.path.join(target_prefix, "Library", "share", "gdal") if is_win else os.path.join(target_prefix, "share", "gdal")

    if os.path.exists(lib_bin) and lib_bin not in os.environ.get("PATH", ""):
        os.environ["PATH"] = lib_bin + os.pathsep + os.environ.get("PATH", "")
        if hasattr(os, "add_dll_directory"):
            try:
                os.add_dll_directory(lib_bin)
            except Exception:
                pass
    if os.path.exists(proj_share):
        os.environ["PROJ_LIB"] = proj_share
        os.environ["PROJ_DATA"] = proj_share
        try:
            import pyproj
            pyproj.datadir.set_data_dir(proj_share)
        except Exception:
            pass
    if os.path.exists(gdal_share):
        os.environ["GDAL_DATA"] = gdal_share

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import joblib
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
import json
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
import io
from contextlib import asynccontextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
MODEL_PATH = os.path.join(DATA_DIR, "ITS_LST_RandomForest_Oct.joblib")
RULES_PATH = os.path.join(DATA_DIR, "intervention_rules.json")
PREDICTORS_TIFF = os.path.join(DATA_DIR, "ITS_LST_Predictors_10m_Oct.tif")
BUILDINGS_GEOJSON = os.path.join(DATA_DIR, "buildings_wgs84.geojson")

# Raster definitions with full derivation documentation
RASTER_CONFIGS = [
    {
        "id": "solar_irradiance",
        "name": "Annual Solar Irradiance (GHI)",
        "module": "energy",
        "file": os.path.join(DATA_DIR, "sebe", "Energyyearroof.tif"),
        "colormap": "YlOrRd",
        "is_log": False,
        "unit": "kWh/m²/yr",
        "min_label": "Low (800)",
        "max_label": "High (1,850+)",
        "derivation": "Simulated via Solar Energy on Building Envelopes (SEBE) model using Surabaya global horizontal irradiance (GHI) and 2m Combined DSM accounting for multi-building roof slope, aspect, and mutual shadowing."
    },
    {
        "id": "daylight_duration",
        "name": "Annual Daylight Duration",
        "module": "energy",
        "file": os.path.join(DATA_DIR, "time_in_daylight.tif"),
        "colormap": "cividis",
        "is_log": False,
        "unit": "Hours/yr",
        "min_label": "Shaded (<1,200 hrs)",
        "max_label": "Clear (3,800+ hrs)",
        "derivation": "Computed using sun position ray-tracing across 365 days on the 2m Digital Surface Model (DSM), tracking unobstructed direct line-of-sight daylight hours."
    },
    {
        "id": "lst_temperature",
        "name": "Land Surface Temperature (LST)",
        "module": "ecology",
        "file": os.path.join(DATA_DIR, "ITS_LST_Prediction_10m_Oct.tif"),
        "colormap": "magma",
        "is_log": False,
        "unit": "°C",
        "min_label": "Cool (30°C)",
        "max_label": "Hot (52°C)",
        "derivation": "Derived from Landsat 8 TIRS Band 10 and Sentinel-2 MSI surface reflectance composite (Oct 2023) using the Radiative Transfer Equation (RTE) and Split-Window algorithm calibrated against urban weather stations."
    },
    {
        "id": "canopy_height",
        "name": "Canopy Height Model (CHM)",
        "module": "ecology",
        "file": os.path.join(DATA_DIR, "canopy_height_aligned.tif"),
        "colormap": "YlGn",
        "is_log": False,
        "unit": "Meters",
        "min_label": "Ground (0 m)",
        "max_label": "Tall Trees (20+ m)",
        "derivation": "Extracted by subtracting high-resolution DEMNAS terrain elevation from the ETH Global Canopy Height 10m GEDI-calibrated surface model."
    },
    {
        "id": "flow_accumulation",
        "name": "Surface Flow Accumulation",
        "module": "hydrology",
        "file": os.path.join(DATA_DIR, "flow_accumulation.tif"),
        "colormap": "PuBu",
        "is_log": True,
        "unit": "Accumulated Cells",
        "min_label": "Ridge / Crest",
        "max_label": "Major Drainage Channel",
        "derivation": "Calculated via D8 deterministic flow routing algorithm on pit-filled DEMNAS (8.27m), identifying surface runoff convergence channels and natural drainage pathways."
    },
    {
        "id": "pooling_depth",
        "name": "Storm Ponding / Pooling Depth",
        "module": "hydrology",
        "file": os.path.join(DATA_DIR, "pooling_depth.tif"),
        "colormap": "Blues",
        "is_log": False,
        "unit": "Meters",
        "min_label": "Dry (0.0 m)",
        "max_label": "Deep Pooling (1.2+ m)",
        "derivation": "Derived by subtracting the raw topographic DEM from the depression-filled hydrologic DEM, highlighting micro-topographic flood basins prone to water accumulation during heavy rainfall."
    }
]

# Global state
RF_MODEL = None
RULES = None
RASTER_CACHE = {}
RASTER_METADATA = []

def generate_raster_png(path: str, cmap_name: str, is_log: bool = False):
    """Reprojects raster to WGS84 EPSG:4326 and renders an RGBA PNG with transparent nodata."""
    if not os.path.exists(path):
        return None, None
    with rasterio.open(path) as src:
        dst_crs = 'EPSG:4326'
        if src.crs and src.crs.to_string() != dst_crs:
            transform, width, height = calculate_default_transform(src.crs, dst_crs, src.width, src.height, *src.bounds)
            dst_arr = np.zeros((height, width), dtype=np.float32)
            reproject(
                source=rasterio.band(src, 1),
                destination=dst_arr,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform,
                dst_crs=dst_crs,
                resampling=Resampling.bilinear
            )
            data = dst_arr
            bounds = rasterio.transform.array_bounds(height, width, transform)
        else:
            data = src.read(1).astype(np.float32)
            bounds = (src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top)

        nodata = src.nodata
        mask = (~np.isnan(data)) & (data > 0)
        if nodata is not None:
            mask = mask & (data != nodata)

        if is_log and np.any(mask):
            plot_data = np.zeros_like(data)
            plot_data[mask] = np.log1p(data[mask])
            vmin = float(np.percentile(plot_data[mask], 5))
            vmax = float(np.percentile(plot_data[mask], 99))
            norm = plt.Normalize(vmin=vmin, vmax=vmax)
            cmap = plt.get_cmap(cmap_name)
            rgba = cmap(norm(plot_data))
        elif np.any(mask):
            vmin = float(np.percentile(data[mask], 2))
            vmax = float(np.percentile(data[mask], 98))
            norm = plt.Normalize(vmin=vmin, vmax=vmax)
            cmap = plt.get_cmap(cmap_name)
            rgba = cmap(norm(data))
        else:
            rgba = np.zeros((*data.shape, 4))

        rgba[~mask] = [0, 0, 0, 0] # Transparent no-data
        img = Image.fromarray((rgba * 255).astype(np.uint8))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue(), [round(float(b), 6) for b in bounds]

@asynccontextmanager
async def lifespan(app: FastAPI):
    global RF_MODEL, RULES, RASTER_CACHE, RASTER_METADATA

    # 1. Load Random Forest Model
    if os.path.exists(MODEL_PATH):
        RF_MODEL = joblib.load(MODEL_PATH)
        print("Random Forest model loaded successfully from", MODEL_PATH)
    else:
        print(f"Warning: Model not found at {MODEL_PATH}")

    # 2. Load Intervention Rules
    if os.path.exists(RULES_PATH):
        with open(RULES_PATH, 'r') as f:
            RULES = json.load(f)
        print("Intervention rules loaded successfully from", RULES_PATH)
    else:
        print(f"Warning: Rules not found at {RULES_PATH}")

    # 3. Pre-render and cache GeoTIFF raster PNGs in memory
    RASTER_CACHE.clear()
    RASTER_METADATA.clear()
    for cfg in RASTER_CONFIGS:
        try:
            png_bytes, bounds = generate_raster_png(cfg['file'], cfg['colormap'], cfg['is_log'])
            if png_bytes and bounds:
                RASTER_CACHE[cfg['id']] = png_bytes
                RASTER_METADATA.append({
                    "id": cfg['id'],
                    "name": cfg['name'],
                    "module": cfg['module'],
                    "unit": cfg['unit'],
                    "colormap": cfg['colormap'],
                    "min_label": cfg['min_label'],
                    "max_label": cfg['max_label'],
                    "derivation": cfg['derivation'],
                    "bounds": bounds
                })
                print(f"Cached raster '{cfg['id']}' ({len(png_bytes)} bytes, bounds: {bounds})")
        except Exception as e:
            print(f"Error caching raster '{cfg['id']}': {e}")

    yield

    # Cleanup
    RF_MODEL = None
    RULES = None
    RASTER_CACHE.clear()
    RASTER_METADATA.clear()

app = FastAPI(title="ITS Digital Twin API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    intervention = None
    for tree in RULES['ecology']['trees']:
        if tree['id'] == req.intervention_id:
            intervention = tree
            break

    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention ID not found")

    try:
        with rasterio.open(PREDICTORS_TIFF) as src:
            if not (src.bounds.left <= req.lon <= src.bounds.right and src.bounds.bottom <= req.lat <= src.bounds.top):
                raise HTTPException(status_code=400, detail="Coordinate is outside campus study area bounds.")
            coords = [(req.lon, req.lat)]
            sampled = list(src.sample(coords))[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Raster sampling failed: {str(e)}")

    if len(sampled) != len(PREDICTOR_NAMES):
        raise HTTPException(status_code=500, detail="Raster bands do not match predictor count")

    features = {name: float(val) for name, val in zip(PREDICTOR_NAMES, sampled)}

    baseline_array = np.array([features[name] for name in PREDICTOR_NAMES]).reshape(1, -1)
    baseline_lst = float(RF_MODEL.predict(baseline_array)[0])

    rf_deltas = intervention.get('rf_deltas', {})
    for key, delta in rf_deltas.items():
        if key in features:
            features[key] += delta

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
    """Serves the lightweight WGS84 GeoJSON for the frontend 3D map"""
    if os.path.exists(BUILDINGS_GEOJSON):
        with open(BUILDINGS_GEOJSON, 'r') as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Buildings file not found")

@app.get("/api/catalog")
def get_catalog():
    """Serves the intervention rules to populate the Vue UI"""
    return RULES

@app.get("/api/rasters")
def get_rasters():
    """Returns metadata and derivation information for all campus GeoTIFF rasters"""
    return RASTER_METADATA

@app.get("/api/rasters/{raster_id}/image")
def get_raster_image(raster_id: str):
    """Serves pre-rendered RGBA PNG with alpha transparency for no-data cells"""
    if raster_id in RASTER_CACHE:
        return Response(content=RASTER_CACHE[raster_id], media_type="image/png")
    raise HTTPException(status_code=404, detail=f"Raster '{raster_id}' not found")
