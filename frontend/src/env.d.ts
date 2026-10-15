/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@deck.gl/mapbox'
declare module '@deck.gl/layers'
declare module '@deck.gl/core'
