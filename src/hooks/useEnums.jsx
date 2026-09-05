import { createContext, useContext, useEffect, useState } from 'react';
import * as metaApi from '../api/meta';

/* GET /meta/enums, fetched once for the whole app and cached.

   Everything the API can return as a stage, status, role or document type
   comes from here. A component that needs the list of stages asks this hook;
   it never writes the list down. CLAUDE.md 2, rule 2. */

const EnumsContext = createContext(null);

const EMPTY = {
  stages: [],
  case_statuses: [],
  compensation_statuses: [],
  rnr_statuses: [],
  objection_statuses: [],
  parcel_statuses: [],
  alert_severities: [],
  roles: [],
  doc_types: [],
};

export function EnumsProvider({ children }) {
  const [enums, setEnums] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    metaApi
      .enums({ signal: controller.signal })
      .then((data) => {
        if (active) setEnums({ ...EMPTY, ...data });
      })
      .catch(() => {
        /* Deliberately swallowed. The enums back filter dropdowns; failing to
           load them should leave those empty, not take down the page the
           person actually asked for. The screen's own useApi call surfaces
           the outage. */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return (
    <EnumsContext.Provider value={{ ...enums, loading }}>{children}</EnumsContext.Provider>
  );
}

export function useEnums() {
  const ctx = useContext(EnumsContext);
  if (!ctx) throw new Error('useEnums must be used inside EnumsProvider');
  return ctx;
}
