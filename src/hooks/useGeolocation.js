import { useCallback, useState } from 'react';

/* One GPS fix, accuracy-checked before it's trusted — the same pattern
   CaptureParcelModal.jsx already uses for registering a parcel, extracted
   so the survey portal's boundary-walking (one fix per corner) and
   current-location capture don't each reimplement it. */

// Above this the reading is tower or wifi triangulation rather than a
// satellite fix, and treating it as a measurement would be filing a guess.
export const MAX_ACCEPTABLE_ACCURACY_M = 100;

const GEOLOCATION_ERRORS = {
  1: 'Location permission was refused. Allow it for this site, then try again.',
  2: 'No position could be obtained. Move somewhere with a clearer view of the sky.',
  3: 'Timed out waiting for a fix. Stay still and try again.',
};

export function useGeolocation() {
  const [fix, setFix] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const capture = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!supported) {
        const message = 'This browser will not report a location. Use a device with location services.';
        setError(message);
        reject(new Error(message));
        return;
      }
      setLocating(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setLocating(false);
          if (latitude === 0 && longitude === 0) {
            const message = 'The device reported (0, 0), which means it has no fix yet.';
            setError(message);
            reject(new Error(message));
            return;
          }
          const result = { latitude, longitude, accuracy };
          setFix(result);
          resolve(result);
        },
        (err) => {
          setLocating(false);
          const message = GEOLOCATION_ERRORS[err.code] || 'Could not read the device location.';
          setError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  }, [supported]);

  return {
    fix,
    locating,
    error,
    capture,
    supported,
    tooLoose: Boolean(fix) && fix.accuracy > MAX_ACCEPTABLE_ACCURACY_M,
  };
}
