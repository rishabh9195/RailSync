# RailSync — SIH26028 frontend prototype

## Run

Open `index.html` directly, or serve this folder with any static server (for example `python -m http.server 8080`) and visit `http://localhost:8080`.

## Structure

- `index.html` introduces the ETA-intelligence product.
- Passenger pages: `passenger.html`, `train.html`, `alerts.html`, and `schedule.html`.
- Operator pages: `operator.html`, `events.html`, `simulation.html`, and `analytics.html`.
- `css/` supplies shared, passenger, operator, and responsive styling.
- `js/mockData.js` is the single mock service boundary; UI scripts call it rather than mutating application data directly.

## Mock architecture and future APIs

`mockData.js` exposes `getTrains`, `getTrain`, `getLiveTrainStatus`, `getPredictedETA`, `getEvents`, `addEvent`, `resolveEvent`, `simulateScenario`, `createBooking`, and `simulatePayment`. Replace their internals with FastAPI `fetch()` calls (such as `/api/trains`, `/api/train/:id/eta`, and `/api/events`) when the backend exists.

State is saved in `localStorage`, so operator disruptions immediately change the passenger ETA, alerts, and risk display in the same browser.

## Suggested demo flow

1. Open `operator.html` and go to Simulation or Events.
2. Apply **Heavy Congestion** or add a **Signal Failure**.
3. Watch the ETA/risk update and then open `train.html` or `alerts.html`.
4. Resolve the event to show ETA recovery.

## Prototype-only

All train movement, weather, operational conditions, analytics, calendar forecasts, and model performance data is simulated. Leaflet and Chart.js load from public CDNs; no real railway, GPS, payment, booking, or authentication integration is included.
