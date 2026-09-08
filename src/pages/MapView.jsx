import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Rectangle,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Crosshair, Layers as LayersIcon, Maximize, RotateCcw } from 'lucide-react';
import * as parcelsApi from '../api/parcels';
import * as casesApi from '../api/cases';
import * as surveyApi from '../api/survey';
import * as referenceApi from '../api/reference';
import { useEnums } from '../hooks/useEnums';
import { useGeolocation } from '../hooks/useGeolocation';
import { parcelStatusLabel, stageLabel } from '../lib/labels';
import * as fmt from '../lib/format';
import PageHeader from '../components/layout/PageHeader';
import ProvenanceBadge from '../components/case/ProvenanceBadge';
import ClusterLayer from '../components/map/ClusterLayer';
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
   nobody surveyed should not be drawn as though somebody had.

   This pass replaces the basemap and adds clustering, layers, a richer
   detail panel, District/Project filters, a mobile bottom sheet, and a
   Field Officer connection — see plans/vectorized-roaming-mist.md for the
   full scoping. Google Maps was the original ask; the user decided against
   the API key and billing it needs, so this stays on Leaflet with two free,
   keyless basemaps instead — nothing here needs an environment variable. */

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
const NEUTRAL_CLASS = 'parcel parcel--neutral';

/* Two free, keyless basemaps — no API key, no billing, no signup.

   CARTO Positron was the first choice here — a lighter basemap than plain
   OSM, built for exactly this "subtle basemap under a data overlay" use
   case — but live-testing this against basemaps.cartocdn.com showed
   "API KEY REQUIRED" watermarked across every tile: CARTO retired anonymous
   access to that endpoint, so it is no longer actually free. Standard
   OpenStreetMap tiles replace it — busier styling, but still genuinely
   keyless. Esri World Imagery stands in for "Satellite" and was verified
   to load without a watermark. */
const BASE_LAYERS = {
  streets: {
    label: 'Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    // No {s} placeholder in this URL, so this is never substituted — but
    // react-leaflet's TileLayer still forwards `subdomains` straight to
    // Leaflet's own `L.TileLayer` options, and passing it as `undefined`
    // (rather than omitting the key) overwrites Leaflet's own default of
    // 'abc' with `undefined`. Later, on every tile Leaflet calls
    // `this.options.subdomains.length` to round-robin a subdomain, which
    // throws on `undefined` — this is exactly the crash that switching to
    // Satellite produced during testing. Keeping this key non-empty avoids
    // that regardless of whether the URL uses it.
    subdomains: 'abc',
  },
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
   Thirteen is where an outline stops being a smudge. Below it, points would
   previously render one <CircleMarker> per parcel with no clustering at
   all — ClusterLayer takes over there instead. */
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

/* Small imperative controls Leaflet doesn't ship a React-friendly version
   of — reads the map instance via useMap() the same way FlyTo/FitBounds do,
   rather than threading map methods back out through refs. */
function MapImperativeControls({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
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

const DEFAULT_LAYERS = {
  projectBoundary: true,
  statusColoring: true,
  surveyLocations: true,
  officerLocation: false,
};

export default function MapView() {
  const navigate = useNavigate();
  const { parcel_statuses: statuses } = useEnums();
  const [params, setParams] = useSearchParams();

  const caseId = params.get('case');
  const parcelParam = params.get('parcel');

  const [status, setStatus] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [baseLayer, setBaseLayer] = useState('streets');
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [surveyTasks, setSurveyTasks] = useState([]);
  const [locateError, setLocateError] = useState(null);

  const officer = useGeolocation();
  const mapRef = useRef(null);

  const requestRef = useRef(0);
  // The last viewport Leaflet reported, so the status filter can refetch the
  // area already on screen without waiting for the user to nudge the map.
  const viewRef = useRef(null);
  // Framing the user's own parcels is a once-per-visit courtesy, not a
  // behaviour. Without this guard the fit would fire on every load it
  // triggered, and the map would fight anyone trying to pan away from it.
  const framedRef = useRef(false);
  const flyNonce = useRef(0);
  const parcelFramedRef = useRef(null);
  const searchDebounce = useRef(null);

  const [districtOptions, setDistrictOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);

  useEffect(() => {
    let active = true;
    referenceApi
      .districts(undefined)
      .then((rows) => {
        if (active) setDistrictOptions(rows || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    referenceApi
      .projects(districtId ? Number(districtId) : undefined)
      .then((rows) => {
        if (active) setProjectOptions(rows || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [districtId]);

  const load = useCallback(async (bounds, parcelStatus, forCase, forDistrict, forProject) => {
    // Leaflet reports a single-point "bounds" for one tick on mount, before
    // the container's own initial `bounds` prop has been fitted — a real
    // request for that view would always be rejected (min === max), so
    // there is nothing to fetch yet. The FlyTo/fitBounds that follows a
    // moment later reports its own real viewport and triggers the load.
    if (bounds.getWest() >= bounds.getEast() || bounds.getSouth() >= bounds.getNorth()) {
      // Not `return` alone: `loading` starts true, so a container that never
      // reports a real size — a viewport too short for `calc(100vh - 220px)`
      // to leave anything, a pane rendered at zero height — would sit on
      // "Loading…" with nothing on its way to replace it.
      setLoading(false);
      return;
    }
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
        districtId: forDistrict || undefined,
        projectId: forProject || undefined,
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
      load(bounds, status, caseId, districtId, projectId);
    },
    [load, status, caseId, districtId, projectId],
  );

  function onStatusChange(value) {
    setStatus(value);
    if (viewRef.current) load(viewRef.current, value, caseId, districtId, projectId);
  }

  function onDistrictChange(value) {
    setDistrictId(value);
    setProjectId('');
    if (viewRef.current) load(viewRef.current, status, caseId, value, '');
  }

  function onProjectChange(value) {
    setProjectId(value);
    if (viewRef.current) load(viewRef.current, status, caseId, districtId, value);
  }

  function clearCaseFilter() {
    params.delete('case');
    params.delete('parcel');
    setParams(params, { replace: true });
    setFrameBounds(null);
    setCaseNumber(null);
    setSurveyTasks([]);
    // Let the next load re-frame on everything this account can see, rather
    // than leaving the map parked on the case it was just showing.
    framedRef.current = false;
  }

  /* When focused on a case, pull that case's parcels independently of the
     viewport so the map can frame them — otherwise opening /map?case=123 on
     an India-wide view would fetch nothing and have nothing to zoom to.
     Also pulls the case's own survey tasks, for the Survey Locations layer:
     a field officer's walked location/boundary only means anything next to
     the case it belongs to. */
  useEffect(() => {
    if (!caseId) {
      setFrameBounds(null);
      setCaseNumber(null);
      setSurveyTasks([]);
      return undefined;
    }
    let active = true;
    (async () => {
      try {
        const [parcels, detail, tasks] = await Promise.all([
          parcelsApi.forCase(caseId),
          casesApi.get(caseId).catch(() => null),
          surveyApi.list({ case_id: caseId }).catch(() => ({ items: [] })),
        ]);
        if (!active) return;
        setCaseNumber(detail ? detail.case_number : null);
        setSurveyTasks(tasks.items || []);
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

  /* /map?case=X&parcel=Y — a Field Officer's "Open on map" link from a
     survey task. Once that case's features have loaded, find the named
     parcel and select it the same way clicking it would. Runs once per
     parcel param, not on every features refresh. */
  useEffect(() => {
    if (!parcelParam || !features.length) return;
    if (parcelFramedRef.current === parcelParam) return;
    const match = features.find((f) => String(f.properties.id) === String(parcelParam));
    if (match) {
      parcelFramedRef.current = parcelParam;
      setSelected(match);
      setFlyTarget({
        lat: match.properties.latitude,
        lon: match.properties.longitude,
        zoom: PARCEL_DETAIL_ZOOM,
        nonce: flyNonce.current++,
      });
    }
  }, [parcelParam, features]);

  /* Search — survey number / ULPIN / case number, queried on the backend
     rather than filtered over whatever happens to already be on screen, so
     a parcel outside the current viewport is still findable. Debounced so
     typing doesn't fire a request per keystroke. */
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    searchDebounce.current = setTimeout(async () => {
      try {
        const results = await parcelsApi.search(q, 8);
        setSearchResults(results);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(searchDebounce.current);
  }, [search]);

  function onPickSearchResult(result) {
    setSearchOpen(false);
    setSearch('');
    navigate(`/map?case=${result.case_id}&parcel=${result.id}`, { replace: false });
  }

  const counts = useMemo(() => {
    const tally = {};
    for (const feature of features) {
      const key = feature.properties.status;
      tally[key] = (tally[key] || 0) + 1;
    }
    return tally;
  }, [features]);

  const drawPolygons = zoom >= POLYGON_MIN_ZOOM;

  function classFor(parcelStatus, isSelected, hasDiscrepancy) {
    const base = layers.statusColoring ? STATUS_CLASS[parcelStatus] || STATUS_CLASS.notified : NEUTRAL_CLASS;
    return [base, isSelected && 'is-selected', hasDiscrepancy && 'has-discrepancy']
      .filter(Boolean)
      .join(' ');
  }

  function selectFeature(feature) {
    setSelected(feature);
    const p = feature.properties;
    if (!drawPolygons) {
      setFlyTarget({ lat: p.latitude, lon: p.longitude, zoom: PARCEL_DETAIL_ZOOM, nonce: flyNonce.current++ });
    }
  }

  const getClusterMarker = useCallback(
    (feature) => {
      const p = feature.properties;
      const isSelected = selected && selected.properties.id === p.id;
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: isSelected ? 8 : 5,
        weight: isSelected ? 3 : 1.5,
        className: classFor(p.status, isSelected, p.has_boundary_discrepancy),
      });
      marker.on('click', () => selectFeature(feature));
      return marker;
    },
    // classFor/selectFeature read component state directly and are cheap to
    // recreate — depending on their identity would rebuild every cluster
    // marker on every render regardless, so the array names the state that
    // actually needs a rebuild instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, layers.statusColoring, drawPolygons],
  );

  function onFitAll() {
    if (features.length) {
      setFrameBounds(extentOf(features));
    }
  }

  function onResetView() {
    framedRef.current = false;
    if (mapRef.current) mapRef.current.fitBounds(INDIA_BOUNDS, { padding: [24, 24] });
  }

  async function onLocateMe() {
    setLocateError(null);
    try {
      await officer.capture();
      setLayers((l) => ({ ...l, officerLocation: true }));
    } catch {
      setLocateError(officer.error || 'Could not read this device’s location.');
    }
  }

  const surveyMarkers = useMemo(() => {
    if (!layers.surveyLocations) return [];
    return surveyTasks.filter((t) => t.location);
  }, [surveyTasks, layers.surveyLocations]);

  const surveyBoundaries = useMemo(() => {
    if (!layers.surveyLocations) return [];
    return surveyTasks.filter((t) => t.boundary_points && t.boundary_points.length >= 3);
  }, [surveyTasks, layers.surveyLocations]);

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
        <div className="map-search">
          <FilterBar.Search
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search survey number, ULPIN or case number…"
          />
          {searchOpen && searchResults.length > 0 && (
            <ul className="map-search__suggestions">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onPickSearchResult(r)}>
                    <span className="case-number">{r.survey_number}</span>
                    <span className="map-search__meta">
                      {r.ulpin ? `${r.ulpin} · ` : ''}
                      {r.case_number}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FilterBar.Select
          label="Status"
          value={status}
          placeholder="All statuses"
          options={statuses.map((value) => ({ value, label: parcelStatusLabel(value) }))}
          onChange={(event) => onStatusChange(event.target.value)}
        />
        <FilterBar.Select
          label="District"
          value={districtId}
          placeholder="All districts"
          options={districtOptions.map((d) => ({ value: String(d.id), label: d.name }))}
          onChange={(event) => onDistrictChange(event.target.value)}
        />
        <FilterBar.Select
          label="Project"
          value={projectId}
          placeholder="All projects"
          options={projectOptions.map((p) => ({ value: String(p.id), label: p.name }))}
          onChange={(event) => onProjectChange(event.target.value)}
        />
        <FilterBar.Actions
          hasFilters={Boolean(status || search || districtId || projectId)}
          filterCount={[status, search, districtId, projectId].filter(Boolean).length}
          onClear={() => {
            setSearch('');
            setDistrictId('');
            setProjectId('');
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
            zoomControl={false}
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
              key={baseLayer}
              attribution={BASE_LAYERS[baseLayer].attribution}
              url={BASE_LAYERS[baseLayer].url}
              subdomains={BASE_LAYERS[baseLayer].subdomains}
              eventHandlers={{ tileerror: () => setTilesFailed(true) }}
            />
            <ViewportReporter onSettled={onSettled} />
            <MapImperativeControls onReady={(map) => (mapRef.current = map)} />
            {/* The cap used to be 12, one level BELOW the zoom at which
                polygons start drawing — so the default view could never show
                a boundary no matter how tightly the parcels clustered. */}
            <FitBounds
              bounds={frameBounds}
              maxZoom={caseId ? PARCEL_DETAIL_ZOOM : PARCEL_DETAIL_ZOOM - 1}
            />
            <FlyTo target={flyTarget} />

            {/* Project boundary — a bounding box of the focused case's
                parcels, never a cadastral outline. There is no real project
                geometry anywhere in the data model; drawing anything more
                specific than a box would misrepresent what this is. */}
            {layers.projectBoundary && caseId && frameBounds && (
              <Rectangle bounds={frameBounds} pathOptions={{ className: 'project-boundary' }} />
            )}

            {drawPolygons
              ? visible(features, search).map((feature) => {
                  const p = feature.properties;
                  const isSelected = selected && selected.properties.id === p.id;
                  const handlers = { click: () => selectFeature(feature) };

                  if (feature.geometry.type === 'Polygon') {
                    return (
                      <Polygon
                        key={p.id}
                        positions={toLatLngRing(feature.geometry.coordinates)}
                        pathOptions={{
                          className: classFor(p.status, isSelected, p.has_boundary_discrepancy),
                          weight: isSelected ? 3 : 1.5,
                        }}
                        eventHandlers={handlers}
                      />
                    );
                  }
                  return (
                    <CircleMarker
                      key={p.id}
                      center={[p.latitude, p.longitude]}
                      radius={isSelected ? 8 : 5}
                      pathOptions={{
                        className: classFor(p.status, isSelected, p.has_boundary_discrepancy),
                        weight: isSelected ? 3 : 1.5,
                      }}
                      eventHandlers={handlers}
                    />
                  );
                })
              : (() => {
                  const shown = visible(features, search);
                  return shown.length > 0 ? <ClusterLayer features={shown} getMarker={getClusterMarker} /> : null;
                })()}

            {/* Survey Locations — a field officer's submitted GPS fix and
                walked boundary, only meaningful next to the case it belongs
                to. Where a survey boundary and the parcel's own recorded
                boundary both exist, they draw together deliberately — the
                gap between the two dashed and solid outlines IS the
                discrepancy, read by eye rather than computed, since nothing
                here does polygon-difference maths. */}
            {layers.surveyLocations &&
              surveyMarkers.map((task) => (
                <CircleMarker
                  key={`survey-loc-${task.id}`}
                  center={[task.location.latitude, task.location.longitude]}
                  radius={6}
                  pathOptions={{ className: 'survey-location' }}
                />
              ))}
            {layers.surveyLocations &&
              surveyBoundaries.map((task) => (
                <Polygon
                  key={`survey-bound-${task.id}`}
                  positions={task.boundary_points.map((pt) => [pt.latitude, pt.longitude])}
                  pathOptions={{ className: 'survey-boundary' }}
                />
              ))}

            {layers.officerLocation && officer.fix && (
              <CircleMarker
                center={[officer.fix.latitude, officer.fix.longitude]}
                radius={7}
                pathOptions={{ className: 'officer-location' }}
              />
            )}
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
          {locateError && (
            <span className="map-chip map-chip--warn">{locateError}</span>
          )}

          <div className="map-controls">
            <button type="button" className="map-controls__btn" onClick={onFitAll} title="Fit all parcels">
              <Maximize size={16} strokeWidth={1.75} />
            </button>
            <button type="button" className="map-controls__btn" onClick={onResetView} title="Reset view">
              <RotateCcw size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="map-controls__btn"
              onClick={onLocateMe}
              disabled={officer.locating}
              title="Locate me"
            >
              <Crosshair size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="map-controls__btn"
              onClick={() => setLayersOpen((v) => !v)}
              title="Layers"
            >
              <LayersIcon size={16} strokeWidth={1.75} />
            </button>
            <div className="map-controls__basetoggle">
              {Object.entries(BASE_LAYERS).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  className={`map-controls__base${baseLayer === key ? ' is-active' : ''}`}
                  onClick={() => setBaseLayer(key)}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {layersOpen && (
            <div className="map-layers">
              <p className="map-layers__title">Layers</p>
              <label>
                <input type="checkbox" checked disabled />
                Parcels
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={layers.statusColoring}
                  onChange={(e) => setLayers((l) => ({ ...l, statusColoring: e.target.checked }))}
                />
                Acquisition status
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={layers.projectBoundary}
                  onChange={(e) => setLayers((l) => ({ ...l, projectBoundary: e.target.checked }))}
                  disabled={!caseId}
                />
                Project boundary{!caseId ? ' (open a case)' : ''}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={layers.surveyLocations}
                  onChange={(e) => setLayers((l) => ({ ...l, surveyLocations: e.target.checked }))}
                  disabled={!caseId}
                />
                Survey locations{!caseId ? ' (open a case)' : ''}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={layers.officerLocation}
                  onChange={(e) => setLayers((l) => ({ ...l, officerLocation: e.target.checked }))}
                  disabled={!officer.fix}
                />
                My location{!officer.fix ? ' (use Locate Me)' : ''}
              </label>
            </div>
          )}
        </div>

        <aside className="map-side">
          {selected ? (
            <ParcelDetailPanel feature={selected} onOpen={() => navigate(`/parcels/${selected.properties.id}`)} />
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
              : 'A plot is about 100 m across, too small to outline at this zoom, so nearby parcels group into clusters. Click one to zoom in, or a single parcel to open its details.'}
          </p>
          <p className="map-hint map-hint--faint">
            Base map: OpenStreetMap &amp; Esri (public, no API key). Parcel data: synthetic prototype
            unless marked otherwise below.
          </p>
        </aside>
      </div>
    </>
  );
}

/* Client-side substring filter kept only as a fallback while the backend
   search box (above) is empty — once a query is typed, results come from
   parcelsApi.search() instead. Left in so panning/zooming without typing
   still shows everything currently in view, unfiltered. */
function visible(features, search) {
  const q = search.trim().toLowerCase();
  if (!q) return features;
  return features.filter((f) => {
    const p = f.properties;
    return (
      p.survey_number.toLowerCase().includes(q) ||
      (p.ulpin || '').toLowerCase().includes(q) ||
      p.owner_name.toLowerCase().includes(q)
    );
  });
}

function ParcelDetailPanel({ feature, onOpen }) {
  const p = feature.properties;
  return (
    <div className="map-selected">
      <p className="map-selected__label">Selected parcel</p>
      <dl>
        <div>
          <dt>Survey No.</dt>
          <dd className="case-number">{p.survey_number}</dd>
        </div>
        {p.ulpin && (
          <div>
            <dt>ULPIN</dt>
            <dd>{p.ulpin}</dd>
          </div>
        )}
        <div>
          <dt>Village</dt>
          <dd>{p.village_name}</dd>
        </div>
        <div>
          <dt>District</dt>
          <dd>{p.district_name}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{p.owner_name}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>{fmt.hectares(p.area_ha)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{parcelStatusLabel(p.status)}</dd>
        </div>
        <div>
          <dt>Boundary</dt>
          <dd>{p.has_boundary ? 'Survey outline on file' : 'GPS fix only — no survey attached'}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>
            <ProvenanceBadge provenance={p.provenance} />
          </dd>
        </div>
      </dl>

      {p.has_boundary_discrepancy && (
        <p className="map-selected__discrepancy" role="alert">
          A re-survey measured
          {p.area_diff_pct !== null && p.area_diff_pct !== undefined
            ? ` ${(p.area_diff_pct * 100).toFixed(1)}%`
            : ' an area'}{' '}
          off the area on file — see the case's discrepancy list.
        </p>
      )}

      {/* Expandable rather than shown by default — project and case are one
          extra fact each, not the headline. */}
      <details className="map-selected__more">
        <summary>Project &amp; case</summary>
        <dl>
          <div>
            <dt>Project</dt>
            <dd>{p.project_name}</dd>
          </div>
          <div>
            <dt>Case</dt>
            <dd>{p.case_number}</dd>
          </div>
          <div>
            <dt>Current stage</dt>
            <dd>{stageLabel(p.case_stage)}</dd>
          </div>
        </dl>
      </details>

      <div className="map-selected__actions">
        <Button variant="primary" block to={`/cases/${p.case_id}`}>
          View case
        </Button>
        <Button variant="quiet" block onClick={onOpen}>
          Full parcel details
        </Button>
      </div>
    </div>
  );
}
