export type ColorMode = 'energy' | 'ecology' | 'hydrology' | 'none'

export type BaseMapStyle = 'dark' | 'streets' | 'satellite' | 'terrain'

export type ActiveTool = 'info' | 'measure' | 'plant_tree' | 'dry_well' | 'retention_pond' | null

export interface MeasurePoint {
  lng: number
  lat: number
}
