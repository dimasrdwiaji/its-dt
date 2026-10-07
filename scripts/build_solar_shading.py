import os
import rasterio
import numpy as np
import whitebox
import matplotlib.pyplot as plt
import geopandas as gpd
from rasterstats import zonal_stats

# Hardcoded fixes for geopandas/pyproj on Windows conda environments
os.environ["PROJ_LIB"] = r"C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\proj"
os.environ["GDAL_DATA"] = r"C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\gdal"
import matplotlib
matplotlib.use('Agg')

def main():
    print("Phase 2 - Python Alternative to SEBE using WhiteboxTools")
    wbt = whitebox.WhiteboxTools()
    wbt.set_working_dir(os.path.abspath('data'))
    wbt.verbose = True
    
    in_dem = "dsm_combined.tif"
    out_file = "time_in_daylight.tif"
    
    # ITS Surabaya coordinates
    lat = -7.281
    lon = 112.795
    utc_offset = "+07:00"
    
    print("Step 1: Calculating Annual Time in Daylight...")
    # Using 10 degree azimuth fraction for speed and max_dist 150m (typical max shadow length on campus)
    # We'll calculate for the whole year, from sunrise to sunset
    # Note: For faster testing, one might use a smaller date range, but WBT is fast.
    # To keep it bounded for sanity check, let's run for full year.
    result = wbt.time_in_daylight(
        dem=in_dem,
        output=out_file,
        az_fraction=5.0,
        max_dist=200.0,
        lat=lat,
        long=lon,
        utc_offset=utc_offset,
        start_day=1,
        end_day=365,
        start_time="sunrise",
        end_time="sunset"
    )
    
    if result != 0:
        print("WhiteboxTools encountered an error!")
        return

    print("Step 2: Processing output and calculating L_shade...")
    with rasterio.open('data/time_in_daylight.tif') as src:
        daylight = src.read(1)
        nodata = src.nodata if src.nodata is not None else -32768.0
        daylight = np.where(daylight == nodata, np.nan, daylight)
    
    # Unshaded max time in daylight (we take the 99th percentile to ignore outliers)
    max_daylight = np.nanpercentile(daylight, 99.5)
    print(f"Max annual daylight hours (unshaded): {max_daylight:.2f}")
    
    # Calculate L_shade raster: L_shade = 1 - (daylight / max_daylight)
    # Clamp below 0 just in case.
    l_shade = 1.0 - (daylight / max_daylight)
    l_shade = np.clip(l_shade, 0, 1)
    
    # Save L_shade raster
    with rasterio.open('data/time_in_daylight.tif') as src:
        meta = src.meta
        meta.update(dtype='float32', nodata=-9999.0)
        out_path = 'data/l_shade_annual.tif'
        with rasterio.open(out_path, 'w', **meta) as dst:
            dst.write(np.where(np.isnan(l_shade), -9999.0, l_shade).astype('float32'), 1)
    print(f"L_shade raster saved to {out_path}")

    print("Step 3: Zonal stats on Buildings for L_shade...")
    # Load buildings
    buildings = gpd.read_file('data/buildings_w_height.parquet') # or geojson if needed
    
    stats = zonal_stats(buildings, out_path, stats=['mean', 'min', 'max'], nodata=-9999.0)
    buildings['l_shade_mean'] = [s['mean'] if s['mean'] is not None else 0 for s in stats]
    buildings['l_shade_min'] = [s['min'] if s['min'] is not None else 0 for s in stats]
    buildings['l_shade_max'] = [s['max'] if s['max'] is not None else 0 for s in stats]
    
    print(f"Buildings Mean Shading Loss: {buildings['l_shade_mean'].mean():.1%}")
    print(f"Buildings Max Shading Loss: {buildings['l_shade_mean'].max():.1%}")
    
    # Save results
    out_bldgs = 'data/buildings_l_shade.geojson'
    buildings.to_file(out_bldgs, driver='GeoJSON')
    print(f"Enriched buildings saved to {out_bldgs}")

    print("Step 4: Generating Sanity Check Plots...")
    os.makedirs('data/plots', exist_ok=True)
    plt.figure(figsize=(10, 8))
    plt.imshow(l_shade, cmap='magma', vmin=0, vmax=0.5)
    plt.colorbar(label='Annual Shading Loss (L_shade)')
    plt.title('Campus L_shade Map (0 = unshaded, 0.5 = 50% shaded)')
    plt.savefig('data/plots/l_shade_map.png', dpi=300, bbox_inches='tight')
    plt.close()

    plt.figure(figsize=(8, 5))
    plt.hist(buildings['l_shade_mean'], bins=50, color='skyblue', edgecolor='black')
    plt.title('Distribution of Average Roof Shading Loss')
    plt.xlabel('L_shade (Mean)')
    plt.ylabel('Number of Buildings')
    plt.savefig('data/plots/l_shade_histogram.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Plots saved in data/plots/")

if __name__ == "__main__":
    main()
