## ITS Surabaya Campus Digital Twin: Architecture & Implementation Specification

**Project Overview:**
A serverless, browser-based digital twin integrating energy, ecology, and hydrology for the Institut Teknologi Sepuluh Nopember (ITS) campus. The platform relies on heavy offline geospatial processing to generate lightweight, static web assets, enabling cross-domain scenario planning and spatial trade-off analysis without requiring an active backend server.

### Inputs

To ensure reproducibility, transparency, and scalability, the digital twin relies heavily on open-source and authoritative public geospatial datasets, tailored to the Indonesian context.

**Spatial Baseline and 3D Geometry**

- **Building Footprints & Infrastructure:** OpenStreetMap (OSM) extracted via Overpass API (GeoJSON/PBF). Serves as the 2D foundation for buildings, roads, and pathways.
- **Elevation Data (DSM/DTM):** DEMNAS (Digital Elevation Model Nasional) provided by Badan Informasi Geospasial (BIG) at ~8m resolution, combined with local UAV photogrammetry (if openly available from the university) for high-resolution roof pitch and terrain modeling. File path: `data/DEMNAS_1608-42_v1.0.tif`
- **LoD1 Building Extrusion:** Building height are stored as an attribute to building footprint. Height taken from Google Open Buildings 2.5D Temporal Dataset. File path: `data/buildings_w_height.parquet`

**Energy & Meteorological Forcing**

- **Typical Meteorological Year (TMY):** PVGIS (Photovoltaic Geographical Information System) 5.x by the EU Joint Research Centre. Provides site-specific hourly solar radiation (GHI, DNI, DHI) and temperature data. File path: `data/umep_surabaya_pvgis.txt`

**Ecology & Land Cover**

- **Vegetation & Thermal Baselines:** Sentinel-2 (10m) and Landsat 8/9 (30m) multispectral imagery via Copernicus or USGS. Used to compute baseline Normalised Difference Vegetation Index (NDVI) and Land Surface Temperature (LST).
- **LST:** LST is processed via resampling Landsat LST into Sentinel-2 resolution via Random Forest, with predictors of relevant spectral indices. LST File path: `data/ITS_LST_Prediction_10m_Oct.tif`. Random forest model path: `data/ITS_LST_RandomForest_Oct.joblib`
- **Tree canopy:** Canopy raster is sourced from META's High Resolution 1m Global Canopy Height Maps. File path: `data/canopy_height.tif`

**Hidrology & Soil**

- Not yet thought of in detail. Might be land cover and some hidrology maps on GEE.

**Processing**
Current code file: `scripts/its_dt.ipynb`

### System Infrastructure & Tech Stack

- **Frontend (Client-Side Runtime):**
- **CesiumJS:** Core 3D engine for rendering campus building meshes (OGC 3D Tiles) and terrain.
- **Chart.js & Tailwind CSS:** For interactive dashboard analytics and responsive UI.
- **Delivery:** Static hosting via Cloudflare Pages or Vercel.

- **Offline Data Processing (Python):**
- **Core Geospatial:** `GeoPandas`, `Rasterio`, `Shapely`.
- **Zonal Aggregation:** Extraction of raster metrics into building polygon boundaries.

- **Storage:**
- Cloud-Optimized GeoTIFFs (COGs) for raster layers (irradiance, surface temp, elevation).
- GeoJSON for building footprints and vector attributes.

### 2. Core Analytical Modules

**2.1. Energy Module**

- **Function:** Models campus energy demand, solar potential, and surface temperature dynamics.
- **Data Inputs:** 3D campus building LOD models, TMY (Typical Meteorological Year) weather files.
- **Processing Stack:**
- **UMEP SEBE:** Computes highly detailed 3D shadow casting and hourly rooftop solar irradiance.
- **pvlib:** Converts irradiance surfaces into accurate photovoltaic yield estimates.

- **Outputs:** Building-level PV yield capacity (kWh/year), Energy Use Intensity (EUI) estimates, and operational carbon metrics.

**2.2. Ecology Module**

- **Function:** Quantifies campus vegetation distribution, canopy shading, and carbon sequestration.
- **Data Inputs:** Tree canopy height map
- **Processing Stack:**

- **Outputs:** NDVI rasters, mapped green spaces, and per-tree carbon sequestration rates based on biological parameters.

**2.3. Hydrology Module**

- **Function:** Simulates surface water runoff, impermeable surface accumulation, and the impact of stormwater management interventions.
- **Data Inputs:** DEMNAS (National Digital Elevation Model), land cover masks.
- **Processing Stack:** Not yet thought of in detail.
- **PySHEDS / PySWMM:** Python-based routing logic to calculate flow direction and accumulation across the campus topology.

- **Outputs:** Catchment runoff coefficients, flood pooling risk areas, and simulation layers showing the mitigation impact of permeable pavements or rain gardens.

### 3. System Features & Decision Support

- **Cross-Domain Scenario Engine:**
  A web-based interface featuring interactive sliders that allow planners to adjust policy inputs (e.g., adding 500 trees vs. deploying solar arrays on 30% of roofs). The engine dynamically calculates trade-offs, mapping exactly which building rooftops lose PV yield due to the shading from newly added adjacent tree canopies.
- **Multi-Criteria Decision Analysis (MCDA):**
  Implemented via `scikit-criteria` (using the TOPSIS method), this feature ranks campus buildings to prioritize retrofits. It evaluates normalized weights across conflicting criteria, such as maximizing solar yield, minimizing local heat exposure, and managing runoff potential.
- **FastAPI / Streamlit Diagnostics (Optional):**
  A localized testing environment to run rapid parameter tuning and validate the Python preprocessing scripts before compiling the final static assets for the web viewer.

### 4. Development Pipeline

1. **Spatial Baseline Construction:** Harmonize campus building footprints, DEMNAS elevation, and aerial imagery into a unified coordinate reference system (EPSG:28992 / EPSG:4326).
2. **Domain Processing:** Execute SAM for land cover, SEBE for irradiance, and PySHEDS for flow routing.
3. **Cross-Domain Fusion:** Use `exactextract` to bind all raster outputs (energy, ecology, hydrology) into a single, enriched GeoJSON attribute table per campus building.
4. **Web Packaging:** Export the final COGs and OGC 3D Tiles, wiring them to the CesiumJS frontend.
