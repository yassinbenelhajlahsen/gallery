import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import type { MediaMeta } from "../../types/mediaTypes";
import { isVideoMeta } from "../../types/mediaTypes";

type GpsItem = MediaMeta & { location: { lat: number; lng: number } };

type Props = {
  items: GpsItem[];
  onClusterSelect: (items: GpsItem[], tapped: GpsItem) => void;
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>';

const buildPinIcon = (isVideo: boolean): L.DivIcon =>
  L.divIcon({
    className: "",
    html: `<span class="gallery-pin ${
      isVideo ? "gallery-pin--video" : ""
    }" role="img" aria-label="${isVideo ? "Video" : "Photo"} location"><span class="gallery-pin__dot"></span></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const buildClusterIcon = (count: number): L.DivIcon => {
  const size = count >= 100 ? "gallery-cluster--lg" : "";
  const display = count > 999 ? "999+" : String(count);
  return L.divIcon({
    className: "",
    html: `<span class="gallery-cluster ${size}"><span class="gallery-cluster__bubble">${display}</span></span>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
};

const FitBounds: React.FC<{ items: GpsItem[] }> = ({ items }) => {
  const map = useMap();
  const lastFitSignature = useRef<string>("");

  useEffect(() => {
    if (!items.length) {
      map.setView([20, 0], 2);
      lastFitSignature.current = "empty";
      return;
    }

    const signature = `${items.length}:${items[0].id}:${items[items.length - 1].id}`;
    if (signature === lastFitSignature.current) return;
    lastFitSignature.current = signature;

    const bounds = L.latLngBounds(
      items.map((i) => [i.location.lat, i.location.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, animate: true });
  }, [items, map]);

  return null;
};

const ClusterLayer: React.FC<Props> = ({ items, onClusterSelect }) => {
  const map = useMap();
  const latestItems = useRef(items);
  const latestSelect = useRef(onClusterSelect);

  useEffect(() => {
    latestItems.current = items;
    latestSelect.current = onClusterSelect;
  }, [items, onClusterSelect]);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: false,
      maxClusterRadius: 30,
      iconCreateFunction: (c) => buildClusterIcon(c.getChildCount()),
    });

    const markerToItem = new WeakMap<L.Marker, GpsItem>();

    latestItems.current.forEach((item) => {
      const marker = L.marker([item.location.lat, item.location.lng], {
        icon: buildPinIcon(isVideoMeta(item)),
        keyboard: true,
        riseOnHover: true,
      });
      markerToItem.set(marker, item);
      marker.on("click", () => {
        latestSelect.current([item], item);
      });
      cluster.addLayer(marker);
    });

    cluster.on("clusterclick", (e: L.LeafletEvent) => {
      const layer = (e as unknown as { layer: L.MarkerCluster }).layer;
      const children = layer.getAllChildMarkers();
      const childItems: GpsItem[] = [];
      children.forEach((m) => {
        const item = markerToItem.get(m as L.Marker);
        if (item) childItems.push(item);
      });
      if (!childItems.length) return;
      // Sort newest-first for a stable modal order (same rule as Timeline).
      childItems.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      latestSelect.current(childItems, childItems[0]);
    });

    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
      cluster.clearLayers();
    };
  }, [items, map]);

  return null;
};

const MapView: React.FC<Props> = ({ items, onClusterSelect }) => {
  const center = useMemo<[number, number]>(() => {
    if (!items.length) return [20, 0];
    return [items[0].location.lat, items[0].location.lng];
  }, [items]);

  return (
    <MapContainer
      center={center}
      zoom={items.length ? 4 : 2}
      minZoom={2}
      maxZoom={18}
      scrollWheelZoom
      zoomControl
      attributionControl
      worldCopyJump
      className="gallery-map-container h-full w-full"
    >
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        subdomains={["a", "b", "c", "d"]}
        crossOrigin="anonymous"
      />
      <FitBounds items={items} />
      <ClusterLayer items={items} onClusterSelect={onClusterSelect} />
    </MapContainer>
  );
};

export default MapView;
