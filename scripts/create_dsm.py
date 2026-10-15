# Load library
import geopandas as gpd
import pandas as pd
import osmnx as ox
import rasterio
from rasterstats import zonal_stats
from rasterio.crs import CRS
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.features import rasterize
from rasterio.fill import fillnodata
from rasterio.windows import from_bounds
import ee
import geemap
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
import numpy as np
import requests
import io
import pvlib
import duckdb
from shapely import wkb

# Query campus boundary
boundary = ox.geocode_to_gdf("Institut Teknologi Sepuluh Nopember")

# Input
DEM = "../data/DEMNAS_1608-42_v1.0.tif"  # DEMNAS, 8m resolution
BUILDINGS = "../data/lod1_gba_sby.gpkg"  # building
CANOPY = "../data/canopy_height.tif"  # tree canopy
OUT = "../data/synthetic_dsm_2m_r3.tif"
OUT_CANOPY = "../data/canopy_dsm.tif"
UTM = CRS.from_epsg(32749)  # UTM zone 49S (cover Surabaya)
DEM_CRS = CRS.from_epsg(4326)
RES = 2.0  # output resolution. Smaller than the approxd. smallest building dimension
BOUNDS = boundary.to_crs(DEM_CRS).total_bounds

# Clip raster to boundary
with rasterio.open(DEM) as src:
    # Read only the window covering your bbox
    window = from_bounds(*BOUNDS, transform=src.transform)
    arr = src.read(1, window=window, masked=True)

# Reproject DEM
transform, width, height = calculate_default_transform(
    DEM_CRS,
    UTM,
    arr.shape[1],
    arr.shape[0],
    *rasterio.transform.array_bounds(
        arr.shape[0], arr.shape[1], src.window_transform(window)
    ),
    resolution=(RES, RES),
)

dem = np.full((height, width), np.nan, dtype="float32")

reproject(
    source=arr.filled(np.nan).astype("float32"),
    destination=dem,
    src_transform=src.window_transform(window),
    src_crs=DEM_CRS,
    dst_transform=transform,
    dst_crs=UTM,
    resampling=Resampling.bilinear,
    src_nodata=np.nan,
    dst_nodata=np.nan,
)

# Per-building roof elevation (absolute)
bldg = gpd.read_file(BUILDINGS).to_crs(UTM)  # reproject to UTM
assert (
    bldg["height"].notna().all()
), "drop or fix buildings without height first"  # Check for building without height


# Extract building terrain elevation
def sample_dem(geom):
    r, c = ~transform * (geom.centroid.x, geom.centroid.y)
    r, c = int(r), int(c)
    if 0 <= r < height and 0 <= c < width:
        return dem[r, c]
    return np.nan


# Calculate terrain and total height
bldg["z_ground"] = bldg.geometry.apply(sample_dem)
bldg["z_top"] = bldg["z_ground"] + bldg["height"]

# Burn mask of where building exist
mask_burned = rasterize(
    ((geom, 1) for geom in bldg.geometry),
    out_shape=dem.shape,
    transform=transform,
    fill=0,
    dtype="uint8",
    all_touched=False,
).astype(bool)

# Burn total elevation values
z_burned = rasterize(
    ((geom, z) for geom, z in zip(bldg.geometry, bldg["z_top"])),
    out_shape=dem.shape,
    transform=transform,
    fill=0,
    dtype="float32",
    all_touched=False,
)

# Combine
dsm = np.where(mask_burned, z_burned, dem)

# Write raster
profile = {
    "driver": "GTiff",
    "height": height,
    "width": width,
    "transform": transform,
    "crs": UTM,
    "count": 1,
    "dtype": "float32",
    "nodata": np.nan,
    "compress": "deflate",
}

with rasterio.open(OUT, "w", **profile) as dst:
    dst.write(dsm.astype("float32"), 1)
