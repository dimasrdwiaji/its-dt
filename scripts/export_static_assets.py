import os
import sys
import json
import shutil
import io
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

# Setup Geo environment paths portably
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

import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
PUBLIC_DIR = os.path.join(PROJECT_DIR, "frontend", "public", "data")
PUBLIC_RASTERS_DIR = os.path.join(PUBLIC_DIR, "rasters")

os.makedirs(PUBLIC_RASTERS_DIR, exist_ok=True)

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

def render_raster_png(path: str, cmap_name: str, is_log: bool = False):
    if not os.path.exists(path):
        print(f"Warning: File not found: {path}")
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

        rgba[~mask] = [0, 0, 0, 0]
        img = Image.fromarray((rgba * 255).astype(np.uint8))
        return img, [round(float(b), 6) for b in bounds]

def main():
    print("=" * 60)
    print("Exporting Static Digital Twin Assets to frontend/public/data/")
    print("=" * 60)

    # 1. Copy buildings_wgs84.geojson -> frontend/public/data/buildings.geojson
    src_buildings = os.path.join(DATA_DIR, "buildings_wgs84.geojson")
    dst_buildings = os.path.join(PUBLIC_DIR, "buildings.geojson")
    if os.path.exists(src_buildings):
        shutil.copyfile(src_buildings, dst_buildings)
        size_kb = os.path.getsize(dst_buildings) / 1024
        print(f"[1/4] Copied buildings.geojson ({size_kb:.1f} KB)")
    else:
        print(f"Error: {src_buildings} does not exist!")

    # 2. Copy intervention_rules.json -> frontend/public/data/catalog.json
    src_catalog = os.path.join(DATA_DIR, "intervention_rules.json")
    dst_catalog = os.path.join(PUBLIC_DIR, "catalog.json")
    if os.path.exists(src_catalog):
        shutil.copyfile(src_catalog, dst_catalog)
        size_kb = os.path.getsize(dst_catalog) / 1024
        print(f"[2/4] Copied catalog.json ({size_kb:.1f} KB)")
    else:
        print(f"Error: {src_catalog} does not exist!")

    # 3. Render all 6 PNG rasters and collect bounds
    rasters_metadata = []
    print("[3/4] Pre-rendering GeoTIFF rasters to RGBA PNGs...")
    for cfg in RASTER_CONFIGS:
        try:
            img, bounds = render_raster_png(cfg['file'], cfg['colormap'], cfg['is_log'])
            if img and bounds:
                out_png_path = os.path.join(PUBLIC_RASTERS_DIR, f"{cfg['id']}.png")
                img.save(out_png_path, format="PNG", optimize=True)
                size_kb = os.path.getsize(out_png_path) / 1024
                print(f"  -> Generated {cfg['id']}.png ({size_kb:.1f} KB, bounds: {bounds})")

                rasters_metadata.append({
                    "id": cfg['id'],
                    "name": cfg['name'],
                    "module": cfg['module'],
                    "unit": cfg['unit'],
                    "colormap": cfg['colormap'],
                    "min_label": cfg['min_label'],
                    "max_label": cfg['max_label'],
                    "derivation": cfg['derivation'],
                    "bounds": bounds,
                    "static_image": f"/data/rasters/{cfg['id']}.png"
                })
        except Exception as e:
            print(f"  -> Error processing {cfg['id']}: {e}")

    # 4. Save rasters.json
    dst_rasters_json = os.path.join(PUBLIC_DIR, "rasters.json")
    with open(dst_rasters_json, "w", encoding="utf-8") as f:
        json.dump(rasters_metadata, f, indent=2)
    print(f"[4/4] Saved rasters.json ({len(rasters_metadata)} raster configurations)")

    print("=" * 60)
    print("Static assets successfully exported for standalone Vercel / Cloudflare deployment!")
    print("=" * 60)

if __name__ == "__main__":
    main()
