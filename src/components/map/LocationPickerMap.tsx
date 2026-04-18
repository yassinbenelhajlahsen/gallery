import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>';

const pickerIcon = L.divIcon({
  className: "",
  html: `<span class="gallery-pin"><span class="gallery-pin__dot"></span></span>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const DEFAULT_CENTER: [number, number] = [40.63128, -73.97335];
const DEFAULT_ZOOM = 12;

type Location = { lat: number; lng: number };

type Props = {
  value: Location | null;
  onChange: (loc: Location) => void;
};

const ClickToSet: React.FC<Pick<Props, "onChange">> = ({ onChange }) => {
  useMapEvents({
    click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
};

const RecenterOnValue: React.FC<{ value: Location | null }> = ({ value }) => {
  const map = useMap();
  const lastSignature = useRef<string>("");

  useEffect(() => {
    if (!value) return;
    const signature = `${value.lat.toFixed(5)}:${value.lng.toFixed(5)}`;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 12), {
      animate: true,
    });
  }, [value, map]);

  return null;
};

const LocationPickerMap: React.FC<Props> = ({ value, onChange }) => {
  const center = useMemo<[number, number]>(
    () => (value ? [value.lat, value.lng] : DEFAULT_CENTER),
    [value],
  );

  return (
    <MapContainer
      center={center}
      zoom={value ? 12 : DEFAULT_ZOOM}
      minZoom={2}
      maxZoom={18}
      scrollWheelZoom
      className="gallery-map-container h-full w-full"
    >
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        subdomains={["a", "b", "c", "d"]}
        crossOrigin="anonymous"
      />
      <ClickToSet onChange={onChange} />
      <RecenterOnValue value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pickerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const { lat, lng } = marker.getLatLng();
              onChange({ lat, lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
};

export default LocationPickerMap;
