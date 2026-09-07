import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';

/* Below the zoom where a parcel's outline would resolve to more than a
   smudge (see MapView's own POLYGON_MIN_ZOOM), parcels drew as one
   <CircleMarker> apiece with no clustering at all — the literal "overlapping
   circles" the map was rebuilt to fix. leaflet.markercluster has no
   react-leaflet wrapper that's kept pace with react-leaflet v4/React 18, so
   this wraps the vanilla plugin imperatively via useMap(), the same pattern
   MapView's own FlyTo/ViewportReporter already use for imperative Leaflet
   calls — not a new architecture, just one more of those.

   `getMarker` builds one vanilla L.circleMarker per feature (not a React
   element — the cluster group owns these directly), so the marker's click
   handler is wired here rather than through React's event system. */
export default function ClusterLayer({ features, getMarker }) {
  const map = useMap();
  const groupRef = useRef(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 60,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      // A cluster's own colour would compete with the status legend for
      // meaning, so it stays a neutral badge — the count is the message,
      // not another status to read.
      iconCreateFunction: (cluster) =>
        L.divIcon({
          html: `<span>${cluster.getChildCount()}</span>`,
          className: 'parcel-cluster',
          iconSize: [36, 36],
        }),
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    const markers = features.map(getMarker);
    group.addLayers(markers);
  }, [features, getMarker]);

  return null;
}
