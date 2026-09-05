import { api, qs } from './client';

/* CSV exports.

   These do not go through api.get: the response is a file, not JSON. api.raw
   returns the Response so the blob can be read and handed to the browser as
   a download — which also means the bearer token travels in the header, as
   it must. A plain <a href> would send no Authorization and get a 401.

   The filename comes from our own template rather than by parsing
   Content-Disposition: the header is ours, the date is ours, and parsing a
   header to recover a string we already know is work that only creates a way
   to get it wrong. */

const EXPORTS = {
  cases: '/exports/cases.csv',
  compensation: '/exports/compensation.csv',
  families: '/exports/families.csv',
  kpis: '/exports/kpis.csv',
};

export async function download(kind, params, opts) {
  const path = EXPORTS[kind];
  if (!path) throw new Error(`Unknown export: ${kind}`);

  const res = await api.raw(`${path}${qs(params)}`, opts);
  const blob = await res.blob();

  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}

export const KINDS = Object.keys(EXPORTS);
