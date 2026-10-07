import os
import matplotlib
matplotlib.use('Agg')
os.environ['PROJ_LIB'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\proj'
os.environ['GDAL_DATA'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\gdal'
os.environ['PATH'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\bin;' + os.environ['PATH']

import geopandas as gpd
import pandas as pd
from rasterstats import zonal_stats
import matplotlib.pyplot as plt
import numpy as np
import rasterio

def main():
    print('Loading buildings_dt_master.geojson...')
    buildings = gpd.read_file('data/buildings_dt_master.geojson')

    print('Step 3: Zonal stats on Buildings for L_shade...')
    stats = zonal_stats(buildings, 'data/l_shade_annual.tif', stats=['mean', 'min', 'max'], nodata=-9999.0)
    buildings['l_shade_mean'] = [s['mean'] if s['mean'] is not None else 0 for s in stats]
    buildings['l_shade_min'] = [s['min'] if s['min'] is not None else 0 for s in stats]
    buildings['l_shade_max'] = [s['max'] if s['max'] is not None else 0 for s in stats]

    mean_shading = buildings["l_shade_mean"].mean()
    max_shading = buildings["l_shade_mean"].max()
    print(f"Buildings Mean Shading Loss: {mean_shading:.1%}")
    print(f"Buildings Max Shading Loss: {max_shading:.1%}")

    out_bldgs = 'data/buildings_l_shade.geojson'
    buildings.to_file(out_bldgs, driver='GeoJSON')
    print(f'Enriched buildings saved to {out_bldgs}')

    with rasterio.open('data/l_shade_annual.tif') as src:
        l_shade = src.read(1)

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

if __name__ == "__main__":
    main()
