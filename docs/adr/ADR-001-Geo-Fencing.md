# ADR-001: Geo-Fencing Module Design

## Status
Accepted

## Date
2026-07-18

## Context
Smart Wage Worker requires a robust, secure, and production-ready Geo-Fencing module to verify worker attendance at active worksites. Daily-wage workers check in, and their presence needs to be verified within a specific worksite radius (e.g., 100 meters). The system needs to log location logs for employer audit history and notify employers if a worker leaves the designated area during their shift.

The application serves low-end smartphones in areas with potentially low connectivity. Additionally, since wage payouts are directly tied to attendance validation, security is paramount to prevent coordinate spoofing and malicious modifications of status history.

---

## Decision
We choose a **hybrid server-authoritative architecture** with the following components:

1. **Client-Side Geolocation Orchestration**:
   - Leverage the standard **HTML5 Geolocation API** (`navigator.geolocation.watchPosition`) wrapped in a React Custom Hook (`useGeoTracking.js`).
   - Implement **throttling and debouncing** to limit location reports to the backend to once every 30 seconds (or when a significant movement threshold is met) to conserve device battery and reduce network load.

2. **Server-Authoritative Calculations**:
   - The React client only transmits raw latitude/longitude coordinates to the backend via REST endpoints.
   - The Express backend calculates distance using the **Haversine Formula** and determines whether the worker is inside or outside the radius.
   - The backend enforces security checks, updates the attendance status document, and logs the records.

3. **Data Storage & Audit Logs**:
   - Save transaction logs to a dedicated `geoFenceLogs` Firestore collection.
   - Set strict Firestore security rules: block client-side writes completely; allow authenticated reads for relevant workers and employers. Update actions are performed exclusively via the backend Express API using the **Firebase Admin SDK**.
   - Create composite indices on `geoFenceLogs` for the query `where("attendanceId")` + `orderBy("timestamp", "desc")`.

4. **Visualization**:
   - Reuse the existing **React Leaflet** library and OpenStreetMap/Google map tiles overlay for mapping visualization. No external Google Maps script dependencies are introduced.

---

## Consequences

### Positive
* **High Security**: Workers cannot spoof their attendance status by editing Firestore directly, as status checks and calculations are calculated securely on the server.
* **Low Battery & Data Usage**: Throttled updates minimize battery drainage on $150 smartphones.
* **Employer Auditing**: Employers gain access to detailed geo-fencing timelines (entry, exit, violations) in real-time.
* **Offline Resilience**: Clean hooks allow local caching of coordinates during network drops, syncing them once back online.

### Negative
* **Server Dependency**: Every location check requires a REST request, adding load to the Express server. (Optimized by stateless service layers and Firestore indexing).
* **Mobile Background Restrictions**: Some mobile browsers suspend JS background threads. Handled by configuring browser options and instructing users to keep the tab active.

---

## Alternatives Considered

### Alternative 1: Pure Client-Side Calculation
* **Description**: React client calculates distance from worksite and updates the `attendance` status directly in Firestore.
* **Reason for Rejection**: Highly insecure. Users could easily intercept and spoof requests, or modify local Javascript states to mark themselves "present" while away from the site.

### Alternative 2: Firestore Direct Client Writes
* **Description**: React client writes coordinates directly to a Firestore collection, and a Firestore Trigger / Cloud Function performs calculations.
* **Reason for Rejection**: Increases database write costs significantly (each tick triggers a Cloud Function), and adds complexity to transaction boundaries. The Express backend architecture is already established and handles auth sessions, making REST endpoint integration cleaner.

### Alternative 3: Google Maps API Integration
* **Description**: Replacing Leaflet with Google Maps SDK.
* **Reason for Rejection**: Violates the user constraint to reuse the existing React Leaflet implementation. Google Maps also requires billing configuration and introduces proprietary API keys.
