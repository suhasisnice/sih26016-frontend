import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as parcelsApi from '../../api/parcels';
import { parcelStatusLabel } from '../../lib/labels';
import Loading from '../states/Loading';
import Empty from '../states/Empty';
import './myland.css';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/* GeoJSON is [lon, lat]; Leaflet wants [lat, lng]. Parcels have no holes,
   so ring 0 is the whole shape — same convention MapView.jsx's own
   toLatLngRing uses. */
function toLatLngRing(polygonCoordinates) {
  return polygonCoordinates[0].map(([lon, lat]) => [lat, lon]);
}

/* A small, read-only view of just this landowner's own parcels on one
   case — not the officer /map page cut down, a separate lighter
   component, since that page is built for a multi-district caseload
   (clustering, layer toggles, a project/district filter bar) none of
   which applies to one household's own land. Reuses the same geometry
   endpoint and the same honest rule MapView.jsx already follows: a
   parcel with no surveyed boundary on file is drawn as the GPS point it
   actually has, never as a fabricated outline. */
export default function MyLandMap({ caseId }) {
  const [state, setState] = useState({ loading: true, error: null, features: [] });

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: null, features: [] });

    parcelsApi
      .forCase(caseId)
      .then((parcels) => {
        if (!active) return;
        if (!parcels.length) {
          setState({ loading: false, error: null, features: [] });
          return;
        }
        // A small padded box around every parcel this case has — cheaper
        // and simpler than the officer map's live-viewport model, since
        // this view never pans to somewhere else.
        const lons = parcels.map((p) => p.longitude);
        const lats = parcels.map((p) => p.latitude);
        const pad = 0.01;
        return parcelsApi
          .bbox({
            minLon: Math.min(...lons) - pad,
            minLat: Math.min(...lats) - pad,
            maxLon: Math.max(...lons) + pad,
            maxLat: Math.max(...lats) + pad,
            caseId,
          })
          .then((collection) => {
            if (active) setState({ loading: false, error: null, features: collection.features });
          });
      })
      .catch((err) => {
        if (active) setState({ loading: false, error: err, features: [] });
      });

    return () => {
      active = false;
    };
  }, [caseId]);

  if (state.loading) return <Loading label="Loading your land on the map" rows={3} />;
  if (state.error) {
    return <Empty center title="Map unavailable" body="Could not load the map right now. Try again shortly." />;
  }
  if (state.features.length === 0) {
    return (
      <Empty
        center
        title="No parcel location on file"
        body="Your parcel has not yet been located on the map. This is added once a field survey has been carried out."
      />
    );
  }

  const center = state.features[0].properties;

  return (
    <div className="myland-map">
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={16}
        scrollWheelZoom={false}
        className="myland-map__canvas"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abc" />
        {state.features.map((feature) => {
          const p = feature.properties;
          const label = `Survey ${p.survey_number} — ${parcelStatusLabel(p.status)}`;
          return feature.geometry.type === 'Polygon' ? (
            <Polygon key={p.id} positions={toLatLngRing(feature.geometry.coordinates)} pathOptions={{ color: 'var(--brand)' }}>
              <Popup>{label}</Popup>
            </Polygon>
          ) : (
            <CircleMarker
              key={p.id}
              center={[p.latitude, p.longitude]}
              radius={10}
              pathOptions={{ color: 'var(--brand)', fillOpacity: 0.6 }}
            >
              <Popup>{label} (GPS location only — no surveyed boundary on file yet)</Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
