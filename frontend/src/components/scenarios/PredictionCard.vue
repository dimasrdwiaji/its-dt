<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import Button from 'primevue/button'

const mapStore = useMapStore()

function closeCard() {
  mapStore.clearLatestPrediction()
}
</script>

<template>
  <div v-if="mapStore.latestPrediction" class="prediction-card">
    <div class="card-header">
      <div class="flex align-items-center gap-2">
        <div class="icon-bubble">
          <i class="pi pi-tree text-green-400"></i>
        </div>
        <div>
          <h3 class="prediction-title">{{ mapStore.latestPrediction.intervention }}</h3>
          <span class="prediction-coords">
            {{ mapStore.latestPrediction.lon.toFixed(5) }}, {{ mapStore.latestPrediction.lat.toFixed(5) }}
          </span>
        </div>
      </div>
      <Button icon="pi pi-times" text rounded size="small" @click="closeCard" />
    </div>

    <!-- Temperature Impact Comparison -->
    <div class="temp-comparison-box">
      <div class="temp-item">
        <span class="temp-label">Baseline LST</span>
        <span class="temp-val">{{ mapStore.latestPrediction.baseline_lst_c }} °C</span>
      </div>
      <div class="arrow-indicator">
        <i class="pi pi-arrow-right text-slate-500"></i>
      </div>
      <div class="temp-item">
        <span class="temp-label">Predicted LST</span>
        <span class="temp-val text-emerald-300">{{ mapStore.latestPrediction.new_lst_c }} °C</span>
      </div>
      <div class="delta-badge">
        <span class="delta-label">Δ LST</span>
        <span class="delta-val">{{ mapStore.latestPrediction.delta_c }} °C</span>
      </div>
    </div>

    <!-- Environmental & Financial Stats -->
    <div class="stats-row">
      <div class="stat-cell">
        <span class="stat-caption">Canopy Radius</span>
        <span class="stat-text">{{ mapStore.latestPrediction.canopy_radius_m }} m</span>
      </div>
      <div class="stat-cell">
        <span class="stat-caption">CO2 Absorption</span>
        <span class="stat-text text-green-400">{{ mapStore.latestPrediction.co2_mitigation_kg_yr }} kg/yr</span>
      </div>
      <div class="stat-cell">
        <span class="stat-caption">Planting Cost</span>
        <span class="stat-text">Rp {{ mapStore.latestPrediction.cost_idr.toLocaleString('id-ID') }}</span>
      </div>
    </div>

    <div class="footer-chip">
      <i class="pi pi-check-circle mr-1 text-emerald-400"></i>
      <span>Tree registered in Scenario Cart</span>
    </div>
  </div>
</template>

<style scoped>
.prediction-card {
  position: absolute;
  top: 72px;
  left: 360px; /* Offset right of ContentPanel */
  width: 330px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: 12px;
  padding: 14px;
  z-index: 1000;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: slideInLeft 0.2s ease-out;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.icon-bubble {
  width: 32px;
  height: 32px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prediction-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
  line-height: 1.2;
}

.prediction-coords {
  font-size: 10px;
  color: #94a3b8;
}

.temp-comparison-box {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.temp-item {
  display: flex;
  flex-direction: column;
}

.temp-label {
  font-size: 9px;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.temp-val {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}

.delta-badge {
  background: rgba(16, 185, 129, 0.18);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 6px;
  padding: 3px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.delta-label {
  font-size: 8px;
  font-weight: 700;
  color: #6ee7b7;
}

.delta-val {
  font-size: 13px;
  font-weight: 800;
  color: #34d1bf;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  background: rgba(15, 23, 42, 0.4);
  padding: 8px;
  border-radius: 6px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
}

.stat-caption {
  font-size: 9px;
  color: #64748b;
  text-transform: uppercase;
}

.stat-text {
  font-size: 11px;
  font-weight: 600;
  color: #f1f5f9;
  margin-top: 2px;
}

.footer-chip {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
  background: rgba(34, 197, 94, 0.08);
  border-radius: 6px;
  padding: 4px 8px;
}
</style>
