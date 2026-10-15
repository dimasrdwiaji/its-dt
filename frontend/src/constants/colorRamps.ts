import type { ColorMode, BuildingProperties } from '@/types'

export interface ColorRampConfig {
  field: keyof BuildingProperties
  min: number
  max: number
  invert?: boolean
}

export const COLOR_RANGES: Record<Exclude<ColorMode, 'none'>, ColorRampConfig> = {
  energy: {
    field: 'pot_energy_mean',
    min: 5000,
    max: 1200000
  },
  ecology: {
    field: 'l_shade_mean',
    min: 0.0,
    max: 0.52,
    invert: true
  },
  hydrology: {
    field: 'adjacent_flood_risk_m3',
    min: 0.4,
    max: 200.0
  }
}

export type RGB = [number, number, number]
export type RGBA = [number, number, number, number]

export const RAMPS: Record<ColorMode, { lo: RGB; hi: RGB }> = {
  energy: {
    lo: [254, 240, 138], // #fef08a (yellow)
    hi: [220, 38, 38]    // #dc2626 (red)
  },
  ecology: {
    lo: [187, 247, 208], // #bbf7d0 (light green)
    hi: [20, 83, 45]     // #14532d (dark green)
  },
  hydrology: {
    lo: [186, 230, 253], // #bae6fd (light blue)
    hi: [30, 58, 95]     // #1e3a5f (deep dark blue)
  },
  none: {
    lo: [232, 234, 237], // #e8eaed (off-white/neutral grey)
    hi: [232, 234, 237]
  }
}

export const COBALT_HIGHLIGHT: RGBA = [26, 86, 219, 245] // #1a56db

export function lerpRGB(lo: RGB, hi: RGB, t: number): RGB {
  return [
    Math.round(lo[0] + (hi[0] - lo[0]) * t),
    Math.round(lo[1] + (hi[1] - lo[1]) * t),
    Math.round(lo[2] + (hi[2] - lo[2]) * t)
  ]
}

export function getBuildingColor(props: BuildingProperties, mode: ColorMode): RGBA {
  if (mode === 'none' || !COLOR_RANGES[mode]) {
    return [...RAMPS.none.lo, 220]
  }

  const cfg = COLOR_RANGES[mode]
  const val = Number(props[cfg.field]) || 0
  let t = Math.min(1, Math.max(0, (val - cfg.min) / (cfg.max - cfg.min)))
  if (cfg.invert) {
    t = 1 - t
  }

  const ramp = RAMPS[mode]
  const rgb = lerpRGB(ramp.lo, ramp.hi, t)
  return [...rgb, 220]
}
