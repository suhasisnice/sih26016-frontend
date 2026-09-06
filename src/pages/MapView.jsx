import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as parcelsApi from '../api/parcels';
import * as casesApi from '../api/cases';
import { useEnums } from '../hooks/useEnums';
import { parcelStatusLabel } from '../lib/labels';
import * as fmt from '../lib/format';
import PageHeader from '../components/layout/PageHeader';
import ProvenanceBadge from '../components/case/ProvenanceBadge';
import FilterBar from '../components/ui/FilterBar';
import Button from '../components/ui/Button';
import ErrorState from '../components/states/ErrorState';
import '../components/map/map.css';

/* A real map, on real tiles.

   CLAUDE.md §5 names `react-leaflet` for maps, and `design/README.md` lists
   `map-view` among the frames that were never exported — so this screen has
   no Figma frame to match, and §5 is the binding instruction. The build this
   replaces drew parcels on a hand-rolled SVG canvas with no basemap, and gave
   each one a decorative outline generated in the browser at render time from
   a seeded PRNG. That outline existed nowhere but the screen: it matched no
   stored geometry, measured no area, and could not be queried.

   What changed underneath: a parcel now has a real `boundary` POLYGON in
   PostGIS, scaled so its area equals the parcel's declared `area_ha`, and
   /parcels/bbox returns it as spec GeoJSON. So the shape on screen is the
   shape in the database is the hectares on the dashboard.

   A parcel with no surveyed boundary — anything registered from the field,
   where a phone gives a GPS fix and not an outline — draws as a point. That
   distinction is shown in the sidebar rather than smoothed over: an outline
   nobody surveyed should not be drawn as though somebody had. */

const STATUS_COLOUR = {
  notified: 'var(--idle)',
  under_acquisition: 'var(--warn)',
  acquired: 'var(--ok)',
  possession_taken: 'var(--info)',
};

/* Leaflet writes its colours onto SVG presentation attributes, and a
   presentation attribute cannot take a `var()` — `fill="var(--ok)"` renders
   as nothing at all. So the paths carry a class and map.css does the colour,
   from the same tokens. The legend swatches below are inline `style`, which
   is real CSS, so those keep using the custom properties directly. */
const STATUS_CLASS = {
  notified: 'parcel parcel--notified',
  under_acquisition: 'parcel parcel--under-acquisition',
  acquired: 'parcel parcel--acquired',
  possession_taken: 'parcel parcel--possession-taken',
};

/* Mainland India plus the island territories, so the opening view is the
   country the problem statement asks for rather than the one state the demo
   data happens to sit in. */
const INDIA_BOUNDS = [
  [6.5, 68.0],
  [35.7, 97.5],
];

/* Below this, a 0.4 ha plot is smaller than one screen pixel and its polygon
   is a wasted path — parcels draw as dots instead. At or above it, the real
   outline is big enough to read and is what gets drawn.

   Ground resolution at 13°N is 152,530 / 2^zoom metres per pixel, so a 1 ha
   plot (about 100 m across) is 1.3 px at zoom 11, 5 px at 13 and 11 px at 14.
   Thirteen is where an outline stops being a smudge. */
const POLYGON_MIN_ZOOM = 13;

/* Where clicking a point takes you. Two levels past the threshold rather than
   exactly at it: arriving at the zoom where shapes have only just resolved
   shows you a smudge and invites another zoom, which is not an arrival. */
const PARCEL_DETAIL_ZOOM = 16;

function toLatLngRing(polygonCoordinates) {
  // GeoJSON is [lon, lat] and Leaflet is [lat, lng]. The outer array is the
  // list of rings; parcels have no holes, so ring 0 is the whole shape.
  return polygonCoordinates[0].map(([lon, lat]) => [lat, lon]);
}

/* Reports the viewport back to the page whenever it settles, and once on
   mount — Leaflet fires no move event for the initial view, so without the
   mount call the map would open empty and stay empty until first dragged. */
function ViewportReporter({ onSettled }) {
  const map = useMapEvents({
    moveend: () => onSettled(map.getBounds(), map.getZoom()),
    zoomend: () => onSettled(map.getBounds(), map.getZoom()),
  });

  useEffect(() => {
    onSettled(map.getBounds(), map.getZoom());
    // Mount only: re-running this on every onSettled identity change would
    // refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/* Frames a set of parcels: one case's plots when the page is opened as
   /map?case=123, and otherwise whatever the signed-in user can see. */
function FitBounds({ bounds, maxZoom }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom });
  }, [bounds, maxZoom, map]);
  return null;
}

/* Drops onto a parcel close enough that its surveyed outline is legible.

   This is the answer to the genuine problem that a district is ~30 km across
   and a parcel is ~100 m: fitting a whole caseload lands around zoom 11,
   where a 1 ha plot is a pixel and a quarter. Points are the honest way to
   draw it at that scale — but then the boundaries, which are the whole point
   of storing geometry, are two unprompted zoom gestures away. Clicking a
   point brings you to them. */
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], target.zoom, { duration: 0.9 });
  }, [target, map]);
  return null;
}

/* The extent of a set of features, from the centroids the API sends with
   every one — so this works the same whether the geometry came back as a
   surveyed polygon or as a bare GPS fix. */
function extentOf(features) {
  if (!features.length) return null;
  const lats = features.map((f) => f.properties.latitude);
  const lons = features.map((f) => f.properties.longitude);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}

export default function MapView() {
  const navigate = useNavigate();
  const { parcel_statuses: statuses } = useEnums();
  const [params, setParams] = useSearchParams();

  const caseId = params.get('case');

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [features, setFeatures] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(5);
  const [frameBounds, setFrameBounds] = useState(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [caseNumber, setCaseNumber] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const requestRef = useRef(0);
  // The last viewport Leaflet reported, so the status filter can refetch the
  // area already on screen without waiting for the user to nudge the map.
  const viewRef = useRef(null);
  // Framing the user's own parcels is a once-per-visit courtesy, not a
  // behaviour. Without this guard the fit would fire on every load it
  // triggered, and the map would fight anyone trying to pan away from it.
  const framedRef = useRef(false);
  const flyNonce = useRef(0);

  const load = useCallback(async (bounds, parcelStatus, forCase) => {
    const id = ++requestRef.current;
    setLoading(true);
    try {
      const data = await parcelsApi.bbox({
        minLon: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLon: bounds.getEast(),
        maxLat: bounds.getNorth(),
        status: parcelStatus || undefined,
        caseId: forCase || undefined,
      });
      if (id !== requestRef.current) return;
      const next = data.features || [];
      setFeatures(next);
      setTruncated(Boolean(data.truncated));
      setError(null);

      /* Open on the land this account actually works with. A national
         opening view is the honest default only for an account that reads
         nationally — for the district officer who is most of the user base
         it is a map of India with one dot on it, and the first thing they
         would do is zoom to their own district anyway. An admin's parcels
         span four states, so this still opens near-national for them.

         Skipped when a case is being focused: that fit is more specific and
         would only be overridden a moment later. */
      if (!framedRef.current && !forCase && next.length) {
        framedRef.current = true;
        setFrameBounds(extentOf(next));
      }
    } catch (err) {
      if (id !== requestRef.current || err.name === 'AbortError') return;
      setError(err);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  const onSettled = useCallback(
    (bounds, nextZoom) => {
      viewRef.current = bounds;
      setZoom(nextZoom);
      load(bounds, status, caseId);
    },
    [load, status, caseId],
  );

  function onStatusChange(value) {
    setStatus(value);
    if (viewRef.current) load(viewRef.current, value, caseId);
  }

  function clearCaseFilter() {
    params.delete('case');
    setParams(params, { replace: true });
    setFrameBounds(null);
    setCaseNumber(null);
    // Let the next load re-frame on everything this account can see, rather
    // than leaving the map parked on the case it was just showing.
    framedRef.current = false;
  }

  /* When focused on a case, pull that case's parcels independently of the
     viewport so the map can frame them — otherwise opening /map?case=123 on
     an India-wide view would fetch nothing and have nothing to zoom to. */
  useEffect(() => {
    if (!caseId) {
      setFrameBounds(null);
      setCaseNumber(null);
      return undefined;
    }
    let active = true;
    (async () => {
      try {
        const [parcels, detail] = await Promise.all([
          parcelsApi.forCase(caseId),
          casesApi.get(caseId).catch(() => null),
        ]);
        if (!active) return;
        setCaseNumber(detail ? detail.case_number : null);
        if (parcels.length) {
          const lats = parcels.map((p) => p.latitude);
          const lons = parcels.map((p) => p.longitude);
          setFrameBounds([
            [Math.min(...lats), Math.min(...lons)],
            [Math.max(...lats), Math.max(...lons)],
          ]);
        }
      } catch {
        // A case the user cannot see, or one with no parcels yet. The map
        // still works; it just does not fly anywhere.
        if (active) setFrameBounds(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [caseId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return features;
    return features.filter((f) => {
      const p = f.properties;
      return p.survey_number.toLowerCase().includes(q) || p.owner_name.toLowerCase().includes(q);
    });
  }, [features, search]);

  const counts = useMemo(() => {
    const tally = {};
    for (const feature of features) {
      const key = feature.properties.status;
      tally[key] = (tally[key] || 0) + 1;
    }
    return tally;
  }, [features]);

  const drawPolygons = zoom >= POLYGON_MIN_ZOOM;

  return (
    <>
      <PageHeader
        eyebrow={['Parcel map', caseNumber || 'National']}
        title="Map View"
        subtitle={
          caseNumber
            ? `Plots acquired under case ${caseNumber}.`
            : 'Every geo-tagged parcel, on its real position. Zoom in to see surveyed boundaries.'
        }
        actions={
          caseId ? (
            <Button variant="secondary" onClick={clearCaseFilter}>
              Show all parcels
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <FilterBar.Search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by survey number or owner…"
        />
        <FilterBar.Select
          label="Status"
          value={status}
          placeholder="All statuses"
          options={statuses.map((value) => ({ value, label: parcelStatusLabel(value) }))}
          onChange={(event) => onStatusChange(event.target.value)}
        />
        <FilterBar.Actions
          hasFilters={Boolean(status || search)}
          filterCount={[status, search].filter(Boolean).length}
          onClear={() => {
            setSearch('');
            onStatusChange('');
          }}
        />
      </FilterBar>

      {error && <ErrorState error={error} title="The map could not load parcels" />}

      <div className="map-shell">
        <div className="map-frame">
          <MapContainer
            className="map-canvas"
            bounds={INDIA_BOUNDS}
            scrollWheelZoom
            /* Nothing south-west of the Indian Ocean or north-east of Tibet
               is ever relevant here, and letting somebody pan to the Pacific
               and find an empty grey world is a worse map than one that
               stops. */
            maxBounds={[
              [-10, 55],
              [45, 110],
            ]}
            maxBoundsViscosity={0.7}
            minZoom={4}
            /* Leaflet snaps to whole zoom levels by default, and fitting
               India into this container wants about 4.4 — which floored to 4
               and opened on half of Asia. Quarter steps let the fit land
               where it was actually asked to. */
            zoomSnap={0.25}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{ tileerror: () => setTilesFailed(true) }}
            />
            <ViewportReporter onSettled={onSettled} />
            {/* The cap used to be 12, one level BELOW the zoom at which
                polygons start drawing — so the default view could never show
                a boundary no matter how tightly the parcels clustered. */}
            <FitBounds
              bounds={frameBounds}
              maxZoom={caseId ? PARCEL_DETAIL_ZOOM : PARCEL_DETAIL_ZOOM - 1}
            />
            <FlyTo target={flyTarget} />

            {visible.map((feature) => {
              const p = feature.properties;
              const isSelected = selected && selected.properties.id === p.id;
              const className = `${STATUS_CLASS[p.status] || STATUS_CLASS.notified}${
                isSelected ? ' is-selected' : ''
              }`;
              const handlers = {
                click: () => {
                  setSelected(feature);
                  // Clicking a point means "show me this one", and at this
                  // zoom the outline is the thing you cannot see yet.
                  if (!drawPolygons) {
                    setFlyTarget({
                      lat: p.latitude,
                      lon: p.longitude,
                      zoom: PARCEL_DETAIL_ZOOM,
                      // Re-clicking the same parcel has to fly again, so the
                      // target must be a new object every time.
                      nonce: flyNonce.current++,
                    });
                  }
                },
              };

              if (drawPolygons && feature.geometry.type === 'Polygon') {
                return (
                  <Polygon
                    key={p.id}
                    positions={toLatLngRing(feature.geometry.coordinates)}
                    pathOptions={{ className, weight: isSelected ? 3 : 1.5 }}
                    eventHandlers={handlers}
                  />
                );
              }
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.latitude, p.longitude]}
                  radius={isSelected ? 8 : 5}
                  pathOptions={{ className, weight: isSelected ? 3 : 1.5 }}
                  eventHandlers={handlers}
                />
              );
            })}
          </MapContainer>

          {loading && <span className="map-chip map-chip--loading">Loading…</span>}
          {!loading && truncated && (
            <span className="map-chip map-chip--warn">
              Showing the first {features.length} — zoom in for the rest
            </span>
          )}
          {tilesFailed && (
            <span className="map-chip map-chip--warn map-chip--offline">
              Basemap unavailable — parcels are still positioned correctly
            </span>
          )}
        </div>

        <aside className="map-side">
          {selected ? (
            <div className="map-selected">
              <p className="map-selected__label">Selected parcel</p>
              <dl>
                <div>
                  <dt>Survey No.</dt>
                  <dd className="case-number">{selected.properties.survey_number}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{selected.properties.owner_name}</dd>
                </div>
                <div>
                  <dt>Area</dt>
                  <dd>{fmt.hectares(selected.properties.area_ha)}</dd>
                </div>
                <div>
                  <dt>Linked case</dt>
                  <dd>{selected.properties.case_number}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{parcelStatusLabel(selected.properties.status)}</dd>
                </div>
                <div>
                  <dt>Boundary</dt>
                  <dd>
                    {selected.properties.has_boundary
                      ? 'Survey outline on file'
                      : 'GPS fix only — no survey attached'}
                  </dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>
                    <ProvenanceBadge provenance={selected.properties.provenance} />
                  </dd>
                </div>
              </dl>
              <Button
                variant="primary"
                block
                onClick={() => navigate(`/parcels/${selected.properties.id}`)}
              >
                View details
              </Button>
            </div>
          ) : (
            <p className="map-hint">Select a parcel on the map to see its details here.</p>
          )}

          <div>
            <p className="fact__label" style={{ marginBottom: 'var(--s3)' }}>
              IN VIEW {loading ? '· loading' : `· ${features.length}`}
            </p>
            <div className="legend">
              {(statuses.length ? statuses : Object.keys(STATUS_COLOUR)).map((value) => (
                <span key={value} className="legend__item">
                  <span
                    className="legend__swatch"
                    style={{ background: STATUS_COLOUR[value] }}
                    aria-hidden="true"
                  />
                  {parcelStatusLabel(value)}
                  <span className="legend__count">{counts[value] || 0}</span>
                </span>
              ))}
            </div>
          </div>

          <p className="map-hint">
            {drawPolygons
              ? 'Shapes are the surveyed boundary on file, drawn to the same hectares the dashboard totals.'
              : 'A plot is about 100 m across, too small to outline at this zoom, so parcels show as points. Click one to drop onto its surveyed boundary.'}
          </p>
        </aside>
      </div>
    </>
  );
}
