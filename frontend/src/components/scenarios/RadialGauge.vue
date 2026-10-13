<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max: number
    icon?: string
    color?: string
    size?: number
    strokeWidth?: number
  }>(),
  {
    icon: 'pi pi-bolt',
    color: '#3b82f6',
    size: 74,
    strokeWidth: 6
  }
)

const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => Math.PI * radius.value) // Half-circle perimeter

const percentage = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(1, Math.max(0, props.value / props.max))
})

const strokeDashoffset = computed(() => {
  return circumference.value * (1 - percentage.value)
})
</script>

<template>
  <div class="radial-gauge" :style="{ width: `${size}px`, height: `${size * 0.62}px` }">
    <svg :width="size" :height="size * 0.62" :viewBox="`0 0 ${size} ${size * 0.62}`">
      <!-- Background Semi-circle Track -->
      <path
        :d="`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`"
        fill="none"
        stroke="rgba(148, 163, 184, 0.2)"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
      />
      <!-- Active Progress Stroke -->
      <path
        :d="`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`"
        fill="none"
        :stroke="color"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        class="progress-path"
      />
    </svg>
    <!-- Centered Icon -->
    <div class="gauge-center-icon">
      <i v-if="icon" :class="icon" :style="{ color: color }"></i>
    </div>
  </div>
</template>

<style scoped>
.radial-gauge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.progress-path {
  transition: stroke-dashoffset 0.25s ease-out;
}

.gauge-center-icon {
  position: absolute;
  bottom: 0px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
</style>
