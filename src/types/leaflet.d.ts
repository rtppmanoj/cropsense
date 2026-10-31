declare module 'leaflet' {
  export interface LatLng { lat: number; lng: number }
  export interface Map { setView(point: [number, number], zoom: number): Map; on(event: 'click', callback: (event: { latlng: LatLng }) => void): Map; getZoom(): number; remove(): void }
  export interface Marker { setLatLng(point: [number, number]): Marker; addTo(map: Map): Marker; on(event: 'dragend', callback: (event: { target: { getLatLng(): LatLng } }) => void): Marker }
  const L: {
    map(element: HTMLElement, options?: { scrollWheelZoom?: boolean }): Map;
    tileLayer(url: string, options?: { maxZoom?: number; attribution?: string }): { addTo(map: Map): unknown };
    marker(point: [number, number], options?: { draggable?: boolean; icon?: unknown }): Marker;
    divIcon(options: { className?: string; html?: string; iconSize?: [number, number]; iconAnchor?: [number, number] }): unknown;
  };
  export default L;
}
