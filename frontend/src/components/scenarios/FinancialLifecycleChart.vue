<script setup lang="ts">
import { computed, ref } from 'vue'
import { useScenarioStore } from '@/stores/scenarioStore'
import Tag from 'primevue/tag'

const scenarioStore = useScenarioStore()
const lifecycle = computed(() => scenarioStore.financialLifecycle)

const hoveredYear = ref<number | null>(null)

// Chart Dimensions
const width = 420
const height = 180
const padding = { top: 20, right: 20, bottom: 25, left: 45 }

const innerWidth = width - padding.left - padding.right
const innerHeight = height - padding.top - padding.bottom

const points = computed(() => {
  const data = lifecycle.value.yearsData
  if (!data || !data.length) return []

  const capex = lifecycle.value.capexIdr
  const allVals = [-capex, ...data.map(d => d.cumulativeCashFlowIdr)]
  const minVal = Math.min(...allVals, -1000000)
  const maxVal = Math.max(...allVals, 1000000)

  // Map 0..25 years
  const getX = (yr: number) => padding.left + (yr / 25) * innerWidth
  const getY = (val: number) => padding.top + innerHeight - ((val - minVal) / (maxVal - minVal)) * innerHeight

  const zeroY = getY(0)

  const pts = [
    { year: 0, x: getX(0), y: getY(-capex), val: -capex },
    ...data.map(d => ({
      year: d.year,
      x: getX(d.year),
      y: getY(d.cumulativeCashFlowIdr),
      val: d.cumulativeCashFlowIdr,
      raw: d
    }))
  ]

  return {
    pts,
    zeroY,
    minVal,
    maxVal,
    pathD: pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }
})

const activeDataPoint = computed(() => {
  if (hoveredYear.value === null) return null
  return points.value.pts.find(p => p.year === hoveredYear.value)
})

function formatRupiah(val: number): string {
  if (Math.abs(val) >= 1000000000) {
    return `${(val / 1000000000).toFixed(2)} Milyar`
  }
  if (Math.abs(val) >= 1000000) {
    return `${(val / 1000000).toFixed(1)} Juta`
  }
  return val.toLocaleString('id-ID')
}
</script>

<template>
  <div class="financial-lifecycle-container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <i class="pi pi-chart-line text-emerald-400 text-sm"></i>
        <span class="text-xs font-bold text-slate-200 tracking-wide uppercase">25-Year Lifecycle Economics (LCC)</span>
      </div>
      <Tag
        v-if="lifecycle.breakevenYear"
        :value="`Breakeven: Year ${lifecycle.breakevenYear}`"
        severity="success"
        size="small"
      />
      <Tag
        v-else
        value="Payback > 25 Yrs"
        severity="warn"
        size="small"
      />
    </div>

    <!-- Quick Financial Highlights -->
    <div class="grid grid-cols-4 gap-1 text-center mb-2">
      <div class="stat-pill">
        <span class="stat-lbl">Simple Payback</span>
        <span class="stat-val text-cyan-300">{{ lifecycle.simplePaybackYears ? `${lifecycle.simplePaybackYears} yrs` : 'N/A' }}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-lbl">25-Yr Net Profit</span>
        <span class="stat-val text-emerald-400">Rp {{ formatRupiah(lifecycle.yearsData[24]?.cumulativeCashFlowIdr || 0) }}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-lbl">25-Yr NPV (6.5%)</span>
        <span class="stat-val text-primary">Rp {{ formatRupiah(lifecycle.npv25yrIdr) }}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-lbl">25-Yr ROI</span>
        <span class="stat-val text-yellow-400">{{ lifecycle.roi25yrPct >= 0 ? '+' : '' }}{{ lifecycle.roi25yrPct }}%</span>
      </div>
    </div>

    <!-- Interactive SVG Curve -->
    <div class="chart-wrapper">
      <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto select-none">
        <defs>
          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34d399" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#34d399" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="debtGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#f87171" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#f87171" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Zero Reference Line -->
        <line
          :x1="padding.left"
          :y1="points.zeroY"
          :x2="width - padding.right"
          :y2="points.zeroY"
          stroke="rgba(148, 163, 184, 0.4)"
          stroke-dasharray="3,3"
          stroke-width="1"
        />
        <text
          :x="padding.left - 6"
          :y="points.zeroY + 3"
          fill="#94a3b8"
          font-size="8"
          text-anchor="end"
        >
          Rp 0
        </text>

        <!-- Cash Flow Line -->
        <path
          :d="points.pathD"
          fill="none"
          stroke="#10b981"
          stroke-width="2.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Milestone Markers (CapEx, Year 10, Year 20, Year 25) -->
        <g v-for="pt in points.pts" :key="pt.year">
          <circle
            v-if="pt.year === 0 || pt.year === lifecycle.breakevenYear || pt.year === 25"
            :cx="pt.x"
            :cy="pt.y"
            :r="pt.year === lifecycle.breakevenYear ? 5 : 3.5"
            :fill="pt.year === lifecycle.breakevenYear ? '#fbbf24' : (pt.val >= 0 ? '#34d399' : '#f87171')"
            stroke="#0f172a"
            stroke-width="1.5"
          />
        </g>

        <!-- Hover Tracking Area -->
        <rect
          v-for="pt in points.pts"
          :key="`hit-${pt.year}`"
          :x="pt.x - 6"
          :y="padding.top"
          :width="12"
          :height="innerHeight"
          fill="transparent"
          class="cursor-pointer"
          @mouseenter="hoveredYear = pt.year"
          @mouseleave="hoveredYear = null"
        />

        <!-- Hover Indicator Line -->
        <g v-if="activeDataPoint">
          <line
            :x1="activeDataPoint.x"
            :y1="padding.top"
            :x2="activeDataPoint.x"
            :y2="height - padding.bottom"
            stroke="#38bdf8"
            stroke-width="1"
            stroke-dasharray="2,2"
          />
          <circle
            :cx="activeDataPoint.x"
            :cy="activeDataPoint.y"
            r="4.5"
            fill="#38bdf8"
            stroke="#0f172a"
            stroke-width="2"
          />
        </g>

        <!-- X Axis Labels -->
        <text :x="padding.left" :y="height - 8" fill="#64748b" font-size="8" text-anchor="middle">Yr 0</text>
        <text :x="padding.left + innerWidth * 0.2" :y="height - 8" fill="#64748b" font-size="8" text-anchor="middle">Yr 5</text>
        <text :x="padding.left + innerWidth * 0.4" :y="height - 8" fill="#64748b" font-size="8" text-anchor="middle">Yr 10</text>
        <text :x="padding.left + innerWidth * 0.6" :y="height - 8" fill="#64748b" font-size="8" text-anchor="middle">Yr 15</text>
        <text :x="padding.left + innerWidth * 0.8" :y="height - 8" fill="#64748b" font-size="8" text-anchor="middle">Yr 20</text>
        <text :x="width - padding.right" :y="height - 8" fill="#64748b" font-size="8" text-anchor="middle">Yr 25</text>
      </svg>

      <!-- Hover Tooltip Overlay -->
      <div v-if="activeDataPoint && activeDataPoint.raw" class="chart-tooltip">
        <div class="flex justify-between text-[11px] font-bold text-slate-200 border-b border-slate-700/60 pb-1 mb-1">
          <span>Year {{ activeDataPoint.year }}</span>
          <span :class="activeDataPoint.val >= 0 ? 'text-emerald-400' : 'text-red-400'">
            {{ activeDataPoint.val >= 0 ? '+' : '' }}Rp {{ formatRupiah(activeDataPoint.val) }}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-x-2 text-[10px] text-slate-300">
          <span>Generation: {{ (activeDataPoint.raw.generationKWh / 1000).toFixed(1) }} MWh</span>
          <span>Bill Savings: Rp {{ formatRupiah(activeDataPoint.raw.billSavingsIdr) }}</span>
          <span>Carbon Credit: Rp {{ formatRupiah(activeDataPoint.raw.carbonRevenueIdr) }}</span>
          <span>Annual O&M: Rp {{ formatRupiah(activeDataPoint.raw.opexIdr) }}</span>
        </div>
      </div>
    </div>

    <!-- Regulatory Grounding Footnote -->
    <div class="regulatory-note">
      <i class="pi pi-verified text-emerald-400 mr-1 text-[10px]"></i>
      <span>Modeled per <strong>Permen ESDM No. 2/2024</strong> (100% self-consumption, zero PLN export credit) on PLN B-3 institutional tariff (Rp 1,444.70/kWh) + IDXCarbon voluntary credits (Rp 69,600/ton).</span>
    </div>
  </div>
</template>

<style scoped>
.financial-lifecycle-container {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  padding: 10px;
}

.stat-pill {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 6px;
  padding: 4px;
}

.stat-lbl {
  display: block;
  font-size: 9px;
  color: #94a3b8;
  text-transform: uppercase;
}

.stat-val {
  display: block;
  font-size: 11px;
  font-weight: 700;
  margin-top: 1px;
}

.chart-wrapper {
  position: relative;
  background: rgba(2, 6, 23, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 6px;
  padding: 4px 6px;
}

.chart-tooltip {
  position: absolute;
  top: 8px;
  right: 12px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 6px;
  padding: 6px 8px;
  min-width: 190px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.regulatory-note {
  font-size: 9.5px;
  color: #94a3b8;
  line-height: 1.35;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}
</style>
