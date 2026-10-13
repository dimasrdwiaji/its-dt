import type { BaseMapStyle } from '@/types'

export interface MapStyleOption {
  key: BaseMapStyle
  label: string
  url: string
  icon: string
}

export const MAP_STYLES: Record<BaseMapStyle, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  terrain: 'mapbox://styles/mapbox/outdoors-v12'
}

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  { key: 'dark', label: 'Dark', url: MAP_STYLES.dark, icon: 'pi pi-moon' },
  { key: 'streets', label: 'Streets', url: MAP_STYLES.streets, icon: 'pi pi-map' },
  { key: 'satellite', label: 'Satellite', url: MAP_STYLES.satellite, icon: 'pi pi-globe' },
  { key: 'terrain', label: 'Terrain', url: MAP_STYLES.terrain, icon: 'pi pi-compass' }
]
