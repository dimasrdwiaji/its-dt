<script setup lang="ts">
import { computed } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import { useMapStore } from '@/stores/mapStore'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const scenarioStore = useScenarioStore()
const mapStore = useMapStore()

const activeMix = computed(() => {
  return {
    id: 'custom',
    name: 'Active Custom Scenario',
    tag: 'Custom',
    tagSeverity: 'primary',
    description: 'User-configured campus scenario mix',
    capexIdr: scenarioStore.totalCapExIdr,
    annualSavingsIdr: scenarioStore.totalAnnualBillSavingsIdr,
    paybackYears: scenarioStore.simplePaybackYears,
    cleanEnergyMWh: scenarioStore.totalCleanEnergyMWh,
    co2OffsetTons: scenarioStore.totalCo2OffsetTons,
    storageAddedM3: scenarioStore.totalStorageAddedM3,
    retentionRatePct: scenarioStore.campusHydrologyImpact.campusRetentionRatePct,
    interventionsCount: scenarioStore.totalInterventionsCount,
    isCurrent: true
  }
})

const presetMixes = [
  {
    id: 'mix_solar',
    name: 'Mix A: Solar Decarbonization',
    tag: 'Energy Focus',
    tagSeverity: 'warn',
    description: 'Full solar rollout across top 25 high-yield unshaded rooftops (>1,300 kWh/kWp/yr).',
    capexIdr: 4850000000,
    annualSavingsIdr: 720000000,
    paybackYears: 6.7,
    cleanEnergyMWh: 498.4,
    co2OffsetTons: 393.7,
    storageAddedM3: 0.0,
    retentionRatePct: 0,
    interventionsCount: 25,
    isCurrent: false
  },
  {
    id: 'mix_sponge',
    name: 'Mix B: Campus Sponge Resilience',
    tag: 'Hydrology Focus',
    tagSeverity: 'info',
    description: 'Comprehensive flood elimination: 35 rooftop torens on flood-adjacent roofs + 18 modular dry wells + 2 detention basins.',
    capexIdr: 685000000,
    annualSavingsIdr: 45000000,
    paybackYears: 15.2,
    cleanEnergyMWh: 0.0,
    co2OffsetTons: 0.0,
    storageAddedM3: 420.0,
    retentionRatePct: 68,
    interventionsCount: 55,
    isCurrent: false
  },
  {
    id: 'mix_forestry',
    name: 'Mix C: Urban Forestry Shield',
    tag: 'Ecology Focus',
    tagSeverity: 'success',
    description: 'Roadside green corridors: 120 Tabebuya & Trembesi street trees + 80 Pucuk Merah hedges + 4 faculty facade greenings.',
    capexIdr: 320000000,
    annualSavingsIdr: 18000000,
    paybackYears: 17.8,
    cleanEnergyMWh: 0.0,
    co2OffsetTons: 64.2,
    storageAddedM3: 0.0,
    retentionRatePct: 8,
    interventionsCount: 204,
    isCurrent: false
  }
]

const allMixes = computed(() => [activeMix.value, ...presetMixes])

function formatIdr(val: number): string {
  if (val >= 1000000000) {
    return `Rp ${(val / 1000000000).toFixed(2)} M`
  }
  if (val >= 1000000) {
    return `Rp ${(val / 1000000).toFixed(1)} Jt`
  }
  return `Rp ${val.toLocaleString('id-ID')}`
}
</script>

<template>
  <div v-if="visible" class="comparison-backdrop" @click.self="emit('close')">
    <div class="comparison-dialog">
      <!-- Modal Header -->
      <div class="dialog-header">
        <div class="flex items-center gap-2">
          <i class="pi pi-sliders-v text-primary text-xl"></i>
          <div>
            <h3 class="dialog-title">Strategic Scenario Mix Comparison</h3>
            <span class="dialog-subtitle">Compare multi-criteria trade-offs between clean energy, flood resilience, and urban cooling</span>
          </div>
        </div>
        <Button icon="pi pi-times" text rounded size="small" @click="emit('close')" />
      </div>

      <!-- Matrix Comparison Table -->
      <div class="comparison-matrix-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th class="metric-col">Key Indicator / Module</th>
              <th
                v-for="mix in allMixes"
                :key="mix.id"
                :class="{ 'current-col': mix.isCurrent }"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="mix-name">{{ mix.name }}</span>
                  <Tag :value="mix.tag" :severity="mix.tagSeverity as any" size="small" />
                </div>
                <span class="mix-desc">{{ mix.description }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- CapEx -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-wallet mr-1 text-primary"></i> Total CapEx Investment
              </td>
              <td v-for="m in allMixes" :key="`capex-${m.id}`" class="metric-cell font-bold">
                {{ formatIdr(m.capexIdr) }}
              </td>
            </tr>

            <!-- Annual Bill Savings -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-bolt mr-1 text-emerald-400"></i> Annual PLN Bill Savings
              </td>
              <td v-for="m in allMixes" :key="`sav-${m.id}`" class="metric-cell text-emerald-400 font-semibold">
                {{ formatIdr(m.annualSavingsIdr) }}/yr
              </td>
            </tr>

            <!-- Simple Payback -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-clock mr-1 text-cyan-400"></i> Simple Payback Period
              </td>
              <td v-for="m in allMixes" :key="`pb-${m.id}`" class="metric-cell text-cyan-300">
                {{ m.paybackYears ? `${m.paybackYears} years` : 'N/A' }}
              </td>
            </tr>

            <!-- Clean Solar Generation -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-sun mr-1 text-yellow-400"></i> Clean Energy Generation
              </td>
              <td v-for="m in allMixes" :key="`clean-${m.id}`" class="metric-cell text-yellow-300">
                {{ m.cleanEnergyMWh }} MWh/yr
              </td>
            </tr>

            <!-- Stormwater Storage Added -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-cloud mr-1 text-sky-400"></i> Storm Retention Capacity
              </td>
              <td v-for="m in allMixes" :key="`stor-${m.id}`" class="metric-cell text-sky-300">
                {{ m.storageAddedM3 }} m³
              </td>
            </tr>

            <!-- Campus Stormwater Retention Rate -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-shield mr-1 text-blue-400"></i> Flood Runoff Retention
              </td>
              <td v-for="m in allMixes" :key="`ret-${m.id}`" class="metric-cell text-blue-300">
                {{ m.retentionRatePct }}% of 100mm storm
              </td>
            </tr>

            <!-- CO2 Mitigation -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-leaf mr-1 text-green-400"></i> Annual CO2 Offset
              </td>
              <td v-for="m in allMixes" :key="`co2-${m.id}`" class="metric-cell text-green-300">
                {{ m.co2OffsetTons }} tons/yr
              </td>
            </tr>

            <!-- Interventions Count -->
            <tr>
              <td class="metric-label">
                <i class="pi pi-list mr-1 text-slate-400"></i> Active Items
              </td>
              <td v-for="m in allMixes" :key="`items-${m.id}`" class="metric-cell text-slate-300">
                {{ m.interventionsCount }} interventions
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <span class="text-xs text-slate-400">
          <i class="pi pi-info-circle mr-1"></i>
          Mixes A, B, and C provide standardized campus benchmarking baselines against your active scenario.
        </span>
        <Button label="Close Comparison" size="small" @click="emit('close')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.comparison-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.comparison-dialog {
  width: 950px;
  max-width: 95vw;
  max-height: 90vh;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.2s ease-out;
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

.dialog-subtitle {
  font-size: 11px;
  color: #94a3b8;
}

.comparison-matrix-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  padding: 16px 20px;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.comparison-table th,
.comparison-table td {
  padding: 10px 14px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  text-align: left;
}

.comparison-table th {
  background: rgba(30, 41, 59, 0.6);
  vertical-align: top;
}

.metric-col {
  width: 220px;
  min-width: 200px;
  color: #94a3b8;
  font-weight: 600;
}

.current-col {
  background: rgba(26, 86, 219, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
}

.mix-name {
  font-weight: 700;
  color: #f8fafc;
  font-size: 12px;
}

.mix-desc {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  font-weight: normal;
  line-height: 1.35;
  margin-top: 4px;
}

.metric-label {
  color: #cbd5e1;
  font-weight: 500;
}

.metric-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.6);
}
</style>
