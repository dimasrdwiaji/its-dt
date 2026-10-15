export type ColorMode = 'energy' | 'ecology' | 'hydrology' | 'none'

export type BaseMapStyle = 'dark' | 'streets' | 'satellite' | 'terrain'

export type ActiveTool = 'info' | 'measure' | 'plant_tree' | 'dry_well' | 'retention_pond' | null

export interface MeasurePoint {
  lng: number
  lat: number
}

export interface RasterLayerInfo {
  id: string
  name: string
  module: 'energy' | 'ecology' | 'hydrology'
  unit: string
  colormap: string
  min_label: string
  max_label: string
  derivation: string
  bounds: [number, number, number, number]
  opacity?: number
  visible?: boolean
}
