import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Point = { latitude: number; longitude: number };
export default function FarmLocationPicker({ point, onSelect, onError, label }: {
  point: Point | null; onSelect: (point: Point, source: 'map' | 'gps') => void;
  onError: (message: string) => void; label: { locate: string; unavailable: string; attribution: string };
}) {
  const container = useRef<HTMLDivElement>(null); const map = useRef<LeafletMap | null>(null); const marker = useRef<LeafletMarker | null>(null); const onSelectRef = useRef(onSelect);
  const latitude = point?.latitude ?? null; const longitude = point?.longitude ?? null;
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView([20.59, 78.96], 4);
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(instance);
    instance.on('click', (event) => onSelectRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }, 'map'));
    map.current = instance;
    return () => { instance.remove(); map.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || latitude === null || longitude === null) return;
    const latLng: [number, number] = [latitude, longitude];
    if (!marker.current) marker.current = L.marker(latLng, { draggable: true, icon: L.divIcon({ className: 'farm-map-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map.current)
      .on('dragend', (event) => { const at = event.target.getLatLng(); onSelectRef.current({ latitude: at.lat, longitude: at.lng }, 'map'); });
    else marker.current.setLatLng(latLng);
    map.current.setView(latLng, Math.max(map.current.getZoom(), 15));
  }, [latitude, longitude]);
  const locate = () => {
    if (!navigator.geolocation) { onError(label.unavailable); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => onSelect({ latitude: coords.latitude, longitude: coords.longitude }, 'gps'), () => onError(label.unavailable), { enableHighAccuracy: true, timeout: 10000 });
  };
  return <div><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs text-[#718074]">{label.attribution}</p><button type="button" onClick={locate} className="secondary-button !px-3 !py-2 text-xs">{label.locate}</button></div><div ref={container} className="farm-map" aria-label={label.attribution} /></div>;
}
