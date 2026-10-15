import os
import sys

# Ensure Windows Conda Library\bin and PROJ/GDAL paths are set properly
conda_prefix = r"C:\Users\Dimas RD\miniconda3\envs\geo_env"
lib_bin = os.path.join(conda_prefix, "Library", "bin")
if os.path.exists(lib_bin):
    os.environ["PATH"] = lib_bin + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory"):
        try:
            os.add_dll_directory(lib_bin)
        except Exception:
            pass

proj_share = os.path.join(conda_prefix, "Library", "share", "proj")
if os.path.exists(proj_share):
    os.environ["PROJ_LIB"] = proj_share

gdal_share = os.path.join(conda_prefix, "Library", "share", "gdal")
if os.path.exists(gdal_share):
    os.environ["GDAL_DATA"] = gdal_share

import matplotlib

matplotlib.use("Agg")

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.warp import reproject, Resampling
import geopandas as gpd
from pysheds.grid import Grid
from pysheds.sview import Raster
from skimage.morphology import reconstruction
from rasterstats import zonal_stats
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import json

# ==============================================================================
# 1. FILE PATHS & PARAMETERS
# ==============================================================================
DSM_PATH = "data/synthetic_dsm_2m_r2.tif"  # NA-filled synthetic DSM (2m resolution)
BUILDINGS_PATH = "data/buildings_w_height.parquet"
CANOPY_PATH = "data/canopy_height.tif"

OUT_POOLING = "data/pooling_depth.tif"
OUT_ACCUM = "data/flow_accumulation.tif"
OUT_BUILDINGS = "data/buildings_dt_master.geojson"
METRICS_JSON = "data/hydrology_summary_metrics.json"
PLOTS_DIR = "data/plots"

os.makedirs(PLOTS_DIR, exist_ok=True)

# Meteorological Forcing: 24-hr Design Storm for Surabaya (SNI / BMKG 5-10 yr return period)
P_MM = 100.0  # mm
# Initial abstraction ratio for urban watersheds (Woodward et al., 2003; Hawkins et al., 2002)
LAMBDA = 0.05


# ==============================================================================
# 2. MAIN HYDROLOGY PROCESSING PIPELINE
# ==============================================================================
def main():
    print("=" * 70)
    print("ITS SURABAYA DIGITAL TWIN - OFFLINE HYDROLOGY MODULE")
    print(
        f"Forcing: Design Storm P = {P_MM} mm | Initial Abstraction lambda = {LAMBDA}"
    )
    print("=" * 70)

    # --- Step 1: Load Terrain and Geometry ---
    print("\n[Step 1] Loading synthetic elevation model & building footprints...")
    buildings = gpd.read_parquet(BUILDINGS_PATH)
    print(f"  - Loaded {len(buildings)} campus building footprints.")

    with rasterio.open(DSM_PATH) as src:
        dsm_arr = src.read(1).astype(np.float64)
        dsm_transform = src.transform
        dsm_crs = src.crs
        dsm_shape = src.shape
        dsm_bounds = src.bounds
        res_x, res_y = abs(dsm_transform[0]), abs(dsm_transform[4])
        pixel_area_m2 = res_x * res_y

    print(f"  - DSM Grid Dimensions: {dsm_shape[0]} rows x {dsm_shape[1]} cols")
    print(f"  - Cell Resolution: {res_x}m x {res_y}m ({pixel_area_m2} m2 per pixel)")
    print(
        f"  - Elevation Range: Min = {dsm_arr.min():.2f}m, Max = {dsm_arr.max():.2f}m"
    )

    # --- Step 2: Land Use Classification & Curve Number (CN) Mapping ---
    print("\n[Step 2] Constructing SCS-CN Land Cover Raster...")
    # Baseline for East Surabaya clay soil (Hydrologic Soil Group D) + urban mixed grounds
    cn_arr = np.full(dsm_shape, 85.0, dtype=np.float32)

    # Burn Tree Canopy (CN = 77 for HSG D woods in good hydrologic condition)
    if os.path.exists(CANOPY_PATH):
        print("  - Warping and burning tree canopy (CN = 77)...")
        with rasterio.open(CANOPY_PATH) as c_src:
            canopy_resampled = np.zeros(dsm_shape, dtype=np.float32)
            reproject(
                source=c_src.read(1),
                destination=canopy_resampled,
                src_transform=c_src.transform,
                src_crs=c_src.crs,
                dst_transform=dsm_transform,
                dst_crs=dsm_crs,
                resampling=Resampling.nearest,
            )
        tree_mask = canopy_resampled >= 2.0
        cn_arr[tree_mask] = 77.0
        print(
            f"    Canopy coverage: {tree_mask.sum() / cn_arr.size * 100:.1f}% of domain area."
        )

    # Burn Building Roofs (CN = 98 for impermeable structural surfaces)
    print("  - Burning building roofs (CN = 98)...")
    geom_value = ((geom, 98.0) for geom in buildings.geometry)
    building_mask = rasterize(
        geom_value,
        out_shape=dsm_shape,
        transform=dsm_transform,
        fill=0,
        dtype=np.float32,
        all_touched=False,
    )
    cn_arr = np.where(building_mask == 98.0, 98.0, cn_arr)

    # --- Step 3: SCS-CN Surface Runoff Volume Calculation ---
    print("\n[Step 3] Computing Infiltration Retention & Runoff Volume...")
    # Potential maximum retention (S in mm)
    S_mm = np.where(cn_arr > 0, (25400.0 / cn_arr) - 254.0, 0.0)
    Ia_mm = LAMBDA * S_mm

    # Runoff depth (Q in mm)
    Q_mm = np.zeros_like(S_mm)
    runoff_mask = (P_MM > Ia_mm) & (cn_arr > 0)
    Q_mm[runoff_mask] = ((P_MM - Ia_mm[runoff_mask]) ** 2) / (
        P_MM + (1.0 - LAMBDA) * S_mm[runoff_mask]
    )

    # Runoff volume (m3 per 4m2 pixel)
    V_m3_pixel = (Q_mm / 1000.0) * pixel_area_m2
    total_runoff_generated_m3 = float(np.sum(V_m3_pixel))
    total_rain_volume_m3 = float(
        (P_MM / 1000.0) * (dsm_shape[0] * dsm_shape[1] * pixel_area_m2)
    )
    overall_runoff_coefficient = total_runoff_generated_m3 / total_rain_volume_m3

    print(f"  - Total Rainfall on Domain: {total_rain_volume_m3:,.1f} m3")
    print(f"  - Total Surface Runoff Generated: {total_runoff_generated_m3:,.1f} m3")
    print(
        f"  - Domain-wide Composite Runoff Coefficient (C): {overall_runoff_coefficient:.3f}"
    )

    # --- Step 4: Topographic Depressions & Morphological Sink Filling ---
    print("\n[Step 4] Executing Morphological Depression Analysis (Vincent 1993)...")
    seed = dsm_arr.copy()
    seed[1:-1, 1:-1] = np.max(dsm_arr) + 10.0  # Set interior to maximum elevation
    filled_dsm = reconstruction(seed, dsm_arr, method="erosion")

    pooling_depth = filled_dsm - dsm_arr
    pooling_depth = np.where(
        pooling_depth < 0.01, 0.0, pooling_depth
    )  # filter millimeter noise

    pond_cells = (pooling_depth >= 0.05).sum()
    pond_area_m2 = pond_cells * pixel_area_m2
    total_pond_storage_m3 = float(np.sum(pooling_depth * pixel_area_m2))

    print(
        f"  - Depressions / Inundation Sinks Identified: {pond_cells:,} cells ({pond_area_m2:,.1f} m2)"
    )
    print(f"  - Maximum Pooling Depth: {np.max(pooling_depth):.2f} m")
    print(
        f"  - Average Depth in Depressions: {np.mean(pooling_depth[pooling_depth >= 0.05]):.2f} m"
    )
    print(
        f"  - Total Campus Topographic Water Trapping Capacity: {total_pond_storage_m3:,.1f} m3"
    )

    # Save Pooling Depth GeoTIFF
    profile = {
        "driver": "GTiff",
        "height": dsm_shape[0],
        "width": dsm_shape[1],
        "transform": dsm_transform,
        "crs": dsm_crs,
        "count": 1,
        "dtype": "float32",
        "nodata": -9999.0,
        "compress": "deflate",
    }
    with rasterio.open(OUT_POOLING, "w", **profile) as dst:
        dst.write(pooling_depth.astype(np.float32), 1)
    print(f"  -> Saved {OUT_POOLING}")

    # --- Step 5: Flow Routing & Mass-Weighted Flow Accumulation ---
    print("\n[Step 5] Routing Surface Water Flow with Pysheds (D8)...")
    grid = Grid.from_raster(DSM_PATH)
    filled_raster = Raster(filled_dsm.astype(np.float32), grid.viewfinder)
    filled_raster.nodata = np.nan

    fdir = grid.flowdir(filled_raster)

    # Route runoff volume (m3) downstream
    v_raster = Raster(V_m3_pixel.astype(np.float64), grid.viewfinder)
    v_raster.nodata = 0.0
    flow_accum_m3 = grid.accumulation(fdir, weights=v_raster)

    with rasterio.open(OUT_ACCUM, "w", **profile) as dst:
        dst.write(flow_accum_m3.astype(np.float32), 1)
    print(f"  -> Saved {OUT_ACCUM}")
    print(f"  - Maximum Channel Flow Accumulation: {np.max(flow_accum_m3):,.1f} m3")

    # --- Step 6: Zonal Statistics & Building Risk Enrichment ---
    print("\n[Step 6] Extracting Building-Level Hydrological Metrics...")
    # 1. Total roof runoff generated by footprint
    roof_stats = zonal_stats(
        buildings, V_m3_pixel, affine=dsm_transform, stats=["sum"], nodata=0.0
    )
    buildings["roof_runoff_vol_m3"] = [
        round(float(s["sum"] or 0.0), 2) for s in roof_stats
    ]

    # Ratio of roof runoff to incident rainfall (should be ~0.948 for CN 98)
    buildings["roof_runoff_coef"] = [
        round(float(vol / ((area * P_MM) / 1000.0)), 3) if area > 0 else 0.0
        for vol, area in zip(buildings["roof_runoff_vol_m3"], buildings["area"])
    ]

    # 2. Adjacent overland flood risk (4m perimeter buffer around building)
    print(
        "  - Computing overland flood exposure within 4m building perimeter buffers..."
    )
    buffered_bldgs = buildings.copy()
    buffered_bldgs.geometry = buffered_bldgs.geometry.buffer(4.0)

    # Query peak flow accumulation passing through perimeter buffer
    flow_stats = zonal_stats(
        buffered_bldgs,
        flow_accum_m3,
        affine=dsm_transform,
        stats=["max"],
        nodata=-9999.0,
    )
    buildings["adjacent_flood_risk_m3"] = [
        round(float(s["max"] or 0.0), 2) for s in flow_stats
    ]

    # Query maximum and mean pooling depth in perimeter buffer
    pond_max_stats = zonal_stats(
        buffered_bldgs,
        pooling_depth,
        affine=dsm_transform,
        stats=["max", "mean"],
        nodata=-9999.0,
    )
    buildings["adjacent_max_pond_depth_m"] = [
        round(float(s["max"] or 0.0), 2) for s in pond_max_stats
    ]
    buildings["adjacent_mean_pond_depth_m"] = [
        round(float(s["mean"] or 0.0), 2) for s in pond_max_stats
    ]

    # Categorize Risk Level
    def classify_risk(row):
        q = row["adjacent_flood_risk_m3"]
        d = row["adjacent_max_pond_depth_m"]
        if q >= 5000.0 or d >= 0.50:
            return "Critical"
        elif q >= 1000.0 or d >= 0.25:
            return "High"
        elif q >= 250.0 or d >= 0.10:
            return "Medium"
        else:
            return "Low"

    buildings["flood_risk_level"] = buildings.apply(classify_risk, axis=1)

    # Save to GeoJSON
    buildings.to_file(OUT_BUILDINGS, driver="GeoJSON")
    print(f"  -> Saved enriched building metrics to {OUT_BUILDINGS}")

    # --- Step 7: Sanity Checks & Quality Assurance ---
    print("\n" + "=" * 70)
    print("STEP 7: SANITY CHECKS & SCIENTIFIC VERIFICATION")
    print("=" * 70)

    # Check 1: Mass Balance
    mass_balance_ok = (overall_runoff_coefficient >= 0.65) and (
        overall_runoff_coefficient <= 0.95
    )
    print(
        f"  [Check 1] Overall Runoff Coefficient C = {overall_runoff_coefficient:.3f}"
    )
    print(
        f"            Status: {'PASS (Consistent with urban clay delta)' if mass_balance_ok else 'FAIL'}"
    )

    # Check 2: Roof Runoff Coefficient
    mean_roof_c = np.mean(buildings["roof_runoff_coef"])
    roof_c_ok = 0.92 <= mean_roof_c <= 0.97
    print(
        f"  [Check 2] Mean Roof Runoff Coefficient = {mean_roof_c:.3f} (Theoretical CN 98 = 0.948)"
    )
    print(f"            Status: {'PASS' if roof_c_ok else 'FAIL'}")

    # Check 3: Pooling Depth Physicality
    max_d = float(np.max(pooling_depth))
    pond_ok = (max_d > 0.1) and (max_d < 15.0) and (pond_cells > 1000)
    print(
        f"  [Check 3] Max Ponding Depth = {max_d:.2f}m across {pond_cells:,} non-zero sink cells"
    )
    print(
        f"            Status: {'PASS (Real physical depressions captured)' if pond_ok else 'FAIL'}"
    )

    # Check 4: Risk Distribution
    risk_counts = buildings["flood_risk_level"].value_counts().to_dict()
    print(f"  [Check 4] Building Vulnerability Distribution: {risk_counts}")

    # Save Summary Metrics JSON
    summary_metrics = {
        "forcing": {"P_mm": P_MM, "lambda": LAMBDA},
        "domain": {
            "total_rainfall_m3": total_rain_volume_m3,
            "total_surface_runoff_m3": total_runoff_generated_m3,
            "composite_runoff_coeff": round(overall_runoff_coefficient, 3),
            "max_flow_accumulation_m3": round(float(np.max(flow_accum_m3)), 2),
            "total_pond_storage_capacity_m3": round(total_pond_storage_m3, 2),
            "max_pooling_depth_m": round(max_d, 2),
            "flooded_cells_gt_10cm": int((pooling_depth >= 0.10).sum()),
        },
        "buildings": {
            "total_buildings": len(buildings),
            "total_roof_runoff_m3": round(
                float(buildings["roof_runoff_vol_m3"].sum()), 2
            ),
            "mean_roof_runoff_m3": round(
                float(buildings["roof_runoff_vol_m3"].mean()), 2
            ),
            "risk_breakdown": risk_counts,
        },
    }
    with open(METRICS_JSON, "w") as f:
        json.dump(summary_metrics, f, indent=2)
    print(f"  -> Exported metrics to {METRICS_JSON}")

    # --- Step 8: Production of Visualizations ---
    print("\n" + "=" * 70)
    print("STEP 8: GENERATING REPORT PLOTS & CHARTS")
    print("=" * 70)

    generate_plots(dsm_arr, cn_arr, flow_accum_m3, pooling_depth, buildings)
    print("All tasks completed successfully!")


# ==============================================================================
# 3. PLOTTING SUITE
# ==============================================================================
def generate_plots(dsm, cn, flow_accum, pooling_depth, buildings):
    plt.style.use(
        "seaborn-v0_8-whitegrid"
        if "seaborn-v0_8-whitegrid" in plt.style.available
        else "default"
    )

    # --- FIGURE 1: 4-Panel Spatial Hydrology Overview ---
    fig, axes = plt.subplots(2, 2, figsize=(16, 14), dpi=300)

    # Panel 1: Elevation DSM
    im0 = axes[0, 0].imshow(dsm, cmap="terrain", origin="upper")
    axes[0, 0].set_title(
        "A. Synthetic DSM with LoD1 Buildings (m)", fontsize=13, weight="bold"
    )
    plt.colorbar(im0, ax=axes[0, 0], fraction=0.046, pad=0.04)

    # Panel 2: Curve Number Classification
    cmap_cn = mcolors.ListedColormap(["#2ca02c", "#bcbd22", "#d62728"])
    bounds_cn = [70, 80, 90, 100]
    norm_cn = mcolors.BoundaryNorm(bounds_cn, cmap_cn.N)
    im1 = axes[0, 1].imshow(cn, cmap=cmap_cn, norm=norm_cn, origin="upper")
    axes[0, 1].set_title(
        "B. Land Cover Curve Number (CN) Map", fontsize=13, weight="bold"
    )
    cbar1 = plt.colorbar(
        im1, ax=axes[0, 1], fraction=0.046, pad=0.04, ticks=[75, 85, 95]
    )
    cbar1.ax.set_yticklabels(["Canopy (77)", "Open/Paved (85)", "Roofs (98)"])

    # Panel 3: Log Flow Accumulation
    log_accum = np.log10(np.where(flow_accum > 0, flow_accum, 1.0))
    im2 = axes[1, 0].imshow(log_accum, cmap="Blues", origin="upper")
    axes[1, 0].set_title(
        "C. Stormwater Flow Accumulation [log10(m3)]", fontsize=13, weight="bold"
    )
    plt.colorbar(im2, ax=axes[1, 0], fraction=0.046, pad=0.04)

    # Panel 4: Pooling Depth (Inundation Sinks)
    masked_pool = np.where(pooling_depth >= 0.05, pooling_depth, np.nan)
    axes[1, 1].imshow(dsm, cmap="gray", alpha=0.35, origin="upper")
    im3 = axes[1, 1].imshow(
        masked_pool, cmap="hot_r", origin="upper", vmin=0.05, vmax=2.5
    )
    axes[1, 1].set_title(
        "D. Topographic Depressions & Pooling Depth (m)", fontsize=13, weight="bold"
    )
    plt.colorbar(im3, ax=axes[1, 1], fraction=0.046, pad=0.04)

    plt.tight_layout()
    p1 = os.path.join(PLOTS_DIR, "hydrology_spatial_overview.png")
    plt.savefig(p1, bbox_inches="tight")
    plt.close()
    print(f"  -> Saved {p1}")

    # --- FIGURE 2: Building Roof Runoff Analytics ---
    fig, axes = plt.subplots(1, 2, figsize=(15, 6), dpi=300)

    # Scatter: Area vs Runoff
    axes[0].scatter(
        buildings["area"],
        buildings["roof_runoff_vol_m3"],
        c="#1f77b4",
        alpha=0.65,
        edgecolors="none",
        s=30,
    )
    # Regression line
    m, b_val = np.polyfit(buildings["area"], buildings["roof_runoff_vol_m3"], 1)
    x_vals = np.linspace(0, buildings["area"].max(), 100)
    axes[0].plot(
        x_vals,
        m * x_vals + b_val,
        color="#d62728",
        linestyle="--",
        linewidth=2,
        label=f"Slope: {m:.3f} m3/m2 (P=100mm)",
    )
    axes[0].set_xlabel("Building Footprint Area (m2)", fontsize=12)
    axes[0].set_ylabel("Roof Runoff Volume (m3)", fontsize=12)
    axes[0].set_title(
        "Roof Footprint Area vs. Stormwater Runoff Generation",
        fontsize=13,
        weight="bold",
    )
    axes[0].legend(frameon=True)

    # Annotate Top 3 largest contributors
    top3 = buildings.nlargest(3, "roof_runoff_vol_m3")
    for _, row in top3.iterrows():
        name = (
            row["name"]
            if (row["name"] and str(row["name"]) != "None")
            else f"ID:{row['id']}"
        )
        axes[0].annotate(
            name[:20],
            (row["area"], row["roof_runoff_vol_m3"]),
            xytext=(10, -10),
            textcoords="offset points",
            fontsize=9,
            weight="bold",
            arrowprops=dict(arrowstyle="->", color="black"),
        )

    # Histogram of Runoff Volumes
    axes[1].hist(
        buildings["roof_runoff_vol_m3"],
        bins=40,
        color="#2b5c8f",
        edgecolor="white",
        alpha=0.85,
    )
    axes[1].axvline(
        buildings["roof_runoff_vol_m3"].mean(),
        color="#d62728",
        linestyle="--",
        linewidth=2,
        label=f"Mean: {buildings['roof_runoff_vol_m3'].mean():.1f} m3",
    )
    axes[1].axvline(
        buildings["roof_runoff_vol_m3"].median(),
        color="#ff7f0e",
        linestyle=":",
        linewidth=2,
        label=f"Median: {buildings['roof_runoff_vol_m3'].median():.1f} m3",
    )
    axes[1].set_xlabel("Roof Runoff Volume (m3 per building)", fontsize=12)
    axes[1].set_ylabel("Number of Buildings", fontsize=12)
    axes[1].set_title(
        "Distribution of Campus Roof Stormwater Discharges", fontsize=13, weight="bold"
    )
    axes[1].legend(frameon=True)

    plt.tight_layout()
    p2 = os.path.join(PLOTS_DIR, "building_runoff_analysis.png")
    plt.savefig(p2, bbox_inches="tight")
    plt.close()
    print(f"  -> Saved {p2}")

    # --- FIGURE 3: Flood Vulnerability & Risk Ranking ---
    fig, axes = plt.subplots(1, 2, figsize=(16, 6), dpi=300)

    # Donut Chart: Risk Distribution
    risk_order = ["Low", "Medium", "High", "Critical"]
    colors = ["#2ca02c", "#ffbb78", "#ff7f0e", "#d62728"]
    counts = [
        buildings["flood_risk_level"].value_counts().get(r, 0) for r in risk_order
    ]

    wedges, texts, autotexts = axes[0].pie(
        counts,
        labels=risk_order,
        autopct="%1.1f%%",
        startangle=140,
        colors=colors,
        wedgeprops=dict(width=0.4, edgecolor="w"),
        textprops=dict(size=11),
    )
    for at in autotexts:
        at.set_weight("bold")
    axes[0].set_title(
        "ITS Campus Buildings by Stormwater Risk Tier", fontsize=13, weight="bold"
    )

    # Bar Chart: Top 12 Most Exposed Buildings by Overland Flow
    top_exposed = buildings.nlargest(12, "adjacent_flood_risk_m3").copy()
    labels = [
        r["name"] if (r["name"] and str(r["name"]) != "None") else f"Bldg {r['id']}"
        for _, r in top_exposed.iterrows()
    ]
    labels = [l[:25] for l in labels]

    y_pos = np.arange(len(labels))
    bars = axes[1].barh(
        y_pos, top_exposed["adjacent_flood_risk_m3"], color="#d62728", alpha=0.85
    )
    axes[1].set_yticks(y_pos)
    axes[1].set_yticklabels(labels, fontsize=10)
    axes[1].invert_yaxis()
    axes[1].set_xlabel(
        "Peak Overland Flow Entering 4m Perimeter Buffer (m3)", fontsize=11
    )
    axes[1].set_title(
        "Top 12 Most Vulnerable Campus Buildings to Flash Flooding",
        fontsize=13,
        weight="bold",
    )

    for bar in bars:
        w = bar.get_width()
        axes[1].text(
            w + 50,
            bar.get_y() + bar.get_height() / 2,
            f"{w:,.0f} m3",
            va="center",
            ha="left",
            fontsize=9,
            weight="bold",
        )

    plt.tight_layout()
    p3 = os.path.join(PLOTS_DIR, "flood_risk_vulnerability.png")
    plt.savefig(p3, bbox_inches="tight")
    plt.close()
    print(f"  -> Saved {p3}")


if __name__ == "__main__":
    main()
