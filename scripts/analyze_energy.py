import os
os.environ['PROJ_LIB'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\proj'
os.environ['GDAL_DATA'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\share\gdal'
os.environ['PATH'] = r'C:\Users\Dimas RD\miniconda3\envs\geo_env\Library\bin;' + os.environ['PATH']

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import geopandas as gpd

def main():
    # Because buildings_dt_master contains geometry, we should use gpd to read it properly if we ever access geom, 
    # but pandas is usually fine. We'll use gpd just in case.
    df = pd.read_parquet('data/buildings_dt_master.parquet')

    bad = df[df['pot_energy_min'] > df['pot_energy_max']]
    print(f'Rows where min > max: {len(bad)}')

    sum_min = df['pot_energy_min'].sum()
    sum_max = df['pot_energy_max'].sum()
    print(f'\nTotal Campus Potential Bounds: {sum_min / 1e6:,.1f} GWh/yr to {sum_max / 1e6:,.1f} GWh/yr')

    eta = 0.20
    df['capacity_kwp'] = df['area'] * eta
    df['yield_mean'] = df['pot_energy_mean'] / df['capacity_kwp']
    ym = df['yield_mean']
    print(f'\nSpecific Yield (Mean) - Average: {ym.mean():.1f} kWh/kWp/yr')
    print(f'Specific Yield Range: {ym.min():.1f} - {ym.max():.1f} kWh/kWp/yr')

    df['interval_width'] = df['pot_energy_max'] / df['pot_energy_min'].replace(0, np.nan)
    iw = df['interval_width']
    print(f'\nInterval Width (Max / Min) - Mean: {iw.mean():.2f}')

    co2_factor = 0.79 # kg / kWh
    tariff = 1444 # IDR / kWh
    print(f'\nCO2 Mitigation Potential: {(sum_min * co2_factor) / 1000:,.0f} to {(sum_max * co2_factor) / 1000:,.0f} Tons/yr')
    print(f'Financial Savings Potential: {(sum_min * tariff) / 1e9:,.1f} to {(sum_max * tariff) / 1e9:,.1f} Billion IDR/yr')

    os.makedirs('data/plots', exist_ok=True)
    plt.figure(figsize=(8, 5))
    plt.hist(iw.dropna(), bins=50, color='lightgreen', edgecolor='black', range=(1, 3))
    plt.title('Distribution of Energy Interval Widths (Max / Min)')
    plt.xlabel('Width Factor')
    plt.ylabel('Buildings')
    plt.savefig('data/plots/energy_width_dist.png', dpi=300)
    plt.close()

    plt.figure(figsize=(8, 5))
    plt.hist(ym.dropna(), bins=50, color='orange', edgecolor='black')
    plt.title('Distribution of Specific Yield (kWh/kWp/yr)')
    plt.xlabel('Specific Yield')
    plt.ylabel('Buildings')
    plt.savefig('data/plots/specific_yield_dist.png', dpi=300)
    plt.close()

    print('Plots saved.')

if __name__ == "__main__":
    main()
