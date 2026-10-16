<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function launchTwin() {
  router.push('/twin')
}

const pillars = [
  {
    icon: 'pi pi-sun',
    title: 'Rooftop Solar PV & Decarbonization',
    desc: 'Hourly solar radiation simulation across campus buildings. Calculates 100% self-consumption savings under Permen ESDM No. 2/2024 and PLN B-3 tariff with zero export credits.',
    tag: 'Energy',
    tagClass: 'pill-solar'
  },
  {
    icon: 'pi pi-cloud',
    title: 'Hydrology & Flood Resilience',
    desc: 'Topographical flow accumulation and monsoon depression modeling based on ALOS DEM. Back-couples rooftop torens, infiltration dry wells, and retention ponds to mitigate pooling depth.',
    tag: 'Hydrology',
    tagClass: 'pill-hydro'
  },
  {
    icon: 'pi pi-compass',
    title: 'Urban Ecology & Microclimate',
    desc: 'Machine learning thermal cooling regression. Plant curbside Tabebuya trees, shrubs, and living walls with road curb snapping to reduce Land Surface Temperature (LST).',
    tag: 'Ecology',
    tagClass: 'pill-eco'
  }
]

const steps = [
  {
    num: '01',
    title: 'Explore Baseline Campus',
    text: 'Navigate the 3D twin, inspect building rooftops, view satellite LST heatmaps, and analyze baseline stormwater flow paths.'
  },
  {
    num: '02',
    title: 'Simulate Interventions',
    text: 'Configure rooftop solar and torens within physical area budgets, or plant roadside shade trees and draw retention ponds.'
  },
  {
    num: '03',
    title: 'Review BOQ & Lifecycle ROI',
    text: 'Inspect 25-year financial cashflows, building-grouped Bill of Quantities with unit costs, and export comprehensive reports.'
  }
]

const datasets = [
  {
    domain: 'Topography & Drainage',
    dataset: 'ALOS PALSAR 12.5m DEM',
    source: 'JAXA / Earthdata',
    usage: 'Flow accumulation, stream network, depression filling'
  },
  {
    domain: 'Thermal Microclimate',
    dataset: 'Landsat 8/9 TIRS (30m)',
    source: 'USGS EarthExplorer',
    usage: 'Baseline Land Surface Temperature (LST) & canopy cooling'
  },
  {
    domain: 'Campus Geometry',
    dataset: 'OpenStreetMap Footprints',
    source: 'OSM Contributors',
    usage: 'Building LoD1 extrusions, road centerline & curb bounds'
  },
  {
    domain: 'Solar Regulation',
    dataset: 'Permen ESDM No. 2/2024',
    source: 'Kementerian ESDM & PLN',
    usage: 'Zero-export self-consumption economics & PLN B-3 tariff'
  }
]
</script>

<template>
  <div class="home-page">
    <div class="page-container">
      
      <!-- Hero Narrative Section -->
      <section class="hero-section">
        <div class="hero-content">
          <div class="hero-tag">Campus Decision-Support Platform</div>
          <h1 class="hero-title">A Living Spatial Model for Surabaya's Tropical Campus</h1>
          <p class="hero-description">
            Institut Teknologi Sepuluh Nopember (ITS) Sukolilo campus encounters intense equatorial urban heat island effects and seasonal monsoon stormwater pooling. The ITS Digital Twin bridges academic geospatial modeling with actionable capital infrastructure planning.
          </p>
          <div class="hero-actions">
            <button class="btn-primary" @click="launchTwin">
              <i class="pi pi-play"></i>
              <span>Launch 3D Digital Twin</span>
            </button>
            <router-link to="/dashboard" class="btn-secondary">
              <i class="pi pi-chart-bar"></i>
              <span>View Scenario Dashboard</span>
            </router-link>
          </div>
        </div>

        <div class="hero-stats-card">
          <div class="stats-header">Campus Baseline Overview</div>
          <div class="stat-item">
            <span class="stat-label">Average Monsoon Pooling</span>
            <span class="stat-val text-hydro font-mono">12,850 m³</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Peak Surface Heat (LST)</span>
            <span class="stat-val text-solar font-mono">36.4 °C</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Annual Grid Electricity Load</span>
            <span class="stat-val font-mono">~18.4 GWh</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rooftop Solar PV Potential</span>
            <span class="stat-val text-eco font-mono">>6.5 GWh / yr</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Modelled Campus Assets</span>
            <span class="stat-val font-mono">100+ Buildings</span>
          </div>
        </div>
      </section>

      <!-- 3 Module Pillars -->
      <section class="pillars-section">
        <div class="section-title">Thematic Simulation Capabilities</div>
        <div class="pillars-grid">
          <div v-for="p in pillars" :key="p.title" class="pillar-card">
            <div class="pillar-top">
              <div class="pillar-icon">
                <i :class="p.icon"></i>
              </div>
              <span class="pillar-tag" :class="p.tagClass">{{ p.tag }}</span>
            </div>
            <h3 class="pillar-title">{{ p.title }}</h3>
            <p class="pillar-desc">{{ p.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 3-Step Guided Workflow -->
      <section class="steps-section">
        <div class="section-title">Guided User Journey</div>
        <div class="steps-grid">
          <div v-for="s in steps" :key="s.num" class="step-card">
            <div class="step-num font-mono">STEP {{ s.num }}</div>
            <h4 class="step-title">{{ s.title }}</h4>
            <p class="step-text">{{ s.text }}</p>
          </div>
        </div>
      </section>

      <!-- Data Transparency Table -->
      <section class="data-section">
        <div class="section-title">Data Provenance & Scientific Grounding</div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Dataset & Spatial Resolution</th>
                <th>Source / Standard</th>
                <th>Usage in Digital Twin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in datasets" :key="d.domain">
                <td class="font-medium text-main">{{ d.domain }}</td>
                <td>{{ d.dataset }}</td>
                <td>{{ d.source }}</td>
                <td>{{ d.usage }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Bottom Launch Banner -->
      <section class="launch-banner">
        <div>
          <h3 class="banner-title">Ready to model sustainability scenarios?</h3>
          <p class="banner-sub">Select buildings to configure solar roofs or plant roadside tree corridors.</p>
        </div>
        <button class="btn-primary" @click="launchTwin">
          <i class="pi pi-arrow-right"></i>
          <span>Open Campus 3D Model</span>
        </button>
      </section>

    </div>
  </div>
</template>

<style scoped>
.home-page {
  height: 100%;
  overflow-y: auto;
  background: var(--bg-canvas);
  padding: 40px 24px 60px;
}

.page-container {
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* Hero Section */
.hero-section {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr;
  gap: 36px;
  align-items: center;
  padding-bottom: 12px;
}

.hero-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  padding: 4px 10px;
  border-radius: 9999px;
  margin-bottom: 14px;
}

.hero-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin: 0 0 14px 0;
}

.hero-description {
  font-size: 14px;
  color: var(--text-body);
  line-height: 1.6;
  margin: 0 0 24px 0;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-primary {
  height: 38px;
  padding: 0 18px;
  background: var(--text-main);
  color: #ffffff;
  border: 1px solid var(--text-main);
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}

.btn-primary:hover {
  background: #332f2c;
  border-color: #332f2c;
}

.btn-secondary {
  height: 38px;
  padding: 0 18px;
  background: #ffffff;
  color: var(--text-body);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}

.btn-secondary:hover {
  background: var(--bg-subtle);
  color: var(--text-main);
}

/* Stats Card */
.hero-stats-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 22px;
  box-shadow: 0 2px 8px rgba(41, 37, 36, 0.03);
}

.stats-header {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid #f7f5f0;
  font-size: 12.5px;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  color: var(--text-muted);
}

.stat-val {
  font-weight: 600;
  color: var(--text-main);
}

.text-solar { color: var(--solar-accent); }
.text-hydro { color: var(--hydro-accent); }
.text-eco { color: var(--eco-accent); }

/* Section Header */
.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 16px;
}

/* Pillars Grid */
.pillars-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.pillar-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 22px;
  box-shadow: 0 2px 6px rgba(41, 37, 36, 0.02);
}

.pillar-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.pillar-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-main);
}

.pillar-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.pill-solar { background: var(--solar-bg); color: var(--solar-accent); }
.pill-hydro { background: var(--hydro-bg); color: var(--hydro-accent); }
.pill-eco { background: var(--eco-bg); color: var(--eco-accent); }

.pillar-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 8px 0;
}

.pillar-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

/* Steps Grid */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.step-card {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 20px;
  border-left: 3px solid var(--text-main);
}

.step-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.step-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 6px 0;
}

.step-text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

/* Table */
.table-container {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(41, 37, 36, 0.02);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th {
  padding: 12px 16px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #f7f5f0;
  color: var(--text-body);
}

.data-table tr:last-child td {
  border-bottom: none;
}

/* Launch Banner */
.launch-banner {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(41, 37, 36, 0.02);
}

.banner-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 4px 0;
}

.banner-sub {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
}
</style>
