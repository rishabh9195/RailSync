const selectedId =
  new URLSearchParams(location.search).get('id') || '12301';



// SINGLE STATION NAME MAP (frontend -> dataset names)


const stationMap = {
    "New Delhi": "New Delhi",
    "Kanpur Central": "Kanpur",
    "Kanpur": "Kanpur",
    "Prayagraj Jn": "Prayagraj",
    "Prayagraj": "Prayagraj",
    "Gaya Jn": "Gaya",
    "Gaya": "Gaya",
    "DDU": "DDU",
    "Howrah": "Howrah",

    "Chennai": "Chennai",
    "Gudur": "Gudur",
    "Nellore": "Nellore",
    "Vijayawada": "Vijayawada",
    "Warangal": "Warangal",
    "Secunderabad": "Secunderabad",
    "Hyderabad": "Hyderabad",
    "Kazipet": "Kazipet",

    "Mumbai": "Mumbai",
    "Pune": "Pune",
    "Solapur": "Solapur",
    "Kalaburagi": "Kalaburagi",
    "Wadi": "Wadi",
    "Surat": "Surat",
    "Vadodara": "Vadodara",
    "Ratlam": "Ratlam",
    "Kota": "Kota",
    "Sealdah": "Sealdah",
    "Asansol": "Asansol",
    "Dhanbad": "Dhanbad"
};


// Request token so a stale async prediction cannot overwrite newer state.
let renderSeq = 0;


// Last authoritative prediction state for this page render.
// Single source used by the ETA card, timeline, notice and the
// "Why did ETA change?" explanation. Set once per renderTrain.
let lastPredictionState = null;


// Anchored ETA: fixed the moment a genuinely NEW ML prediction
// arrives (predictionReceivedAt + ML remaining minutes). Live ticks
// reuse this stored timestamp and only count the remaining time
// down — they must NEVER recompute Date.now() + remaining, which
// would drag the arrival forward with the clock. Re-anchored only
// when the prediction itself changes (new /predict response for a
// new section or new operator inputs) or an explicit refresh.
let anchoredPrediction = null;


// Active demo/what-if scenario on this page (mock simulation
// only — never sent to the ML backend). Null when untouched.
let activeDemoScenario = null;


// ============================================================
// SIMULATED WEATHER BY STATION (demo values only, not live)
// ============================================================

const weatherByStation = {
    "Sealdah": { condition: "Clear", impact: 0 },
    "Asansol": { condition: "Light Rain", impact: 3 },
    "Dhanbad": { condition: "Cloudy", impact: 2 },
    "Gaya": { condition: "Heavy Rain", impact: 8 },
    "DDU": { condition: "Moderate Rain", impact: 5 },
    "New Delhi": { condition: "Clear", impact: 0 },
    "Kanpur": { condition: "Cloudy", impact: 2 },
    "Prayagraj": { condition: "Light Rain", impact: 3 },
    "Howrah": { condition: "Rain", impact: 5 },
    "Chennai": { condition: "Cloudy", impact: 2 },
    "Gudur": { condition: "Light Rain", impact: 3 },
    "Nellore": { condition: "Clear", impact: 0 },
    "Vijayawada": { condition: "Moderate Rain", impact: 5 },
    "Warangal": { condition: "Cloudy", impact: 2 },
    "Secunderabad": { condition: "Clear", impact: 0 },
    "Hyderabad": { condition: "Light Rain", impact: 3 },
    "Kazipet": { condition: "Moderate Rain", impact: 5 },
    "Mumbai": { condition: "Rain", impact: 5 },
    "Pune": { condition: "Cloudy", impact: 2 },
    "Solapur": { condition: "Clear", impact: 0 },
    "Kalaburagi": { condition: "Light Rain", impact: 3 },
    "Wadi": { condition: "Cloudy", impact: 2 },
    "Surat": { condition: "Rain", impact: 5 },
    "Vadodara": { condition: "Clear", impact: 0 },
    "Ratlam": { condition: "Cloudy", impact: 2 },
    "Kota": { condition: "Light Rain", impact: 3 }
};


function getWeatherImpactLabel(impact) {
    if (impact === 0) {
        return "No significant impact";
    } else if (impact <= 3) {
        return "Low impact";
    } else if (impact <= 7) {
        return "Moderate impact";
    }
    return "High impact";
}


// Paint the static SIMULATED WEATHER FEED card for the current station.
// The card exists as hardcoded HTML in train.html; this only updates its
// text content on every render so it follows the train. Styling untouched.
function paintWeatherCard(currentStation) {
    const weather =
        weatherByStation[currentStation] || { condition: "Clear", impact: 0 };

    const impactLabel =
        getWeatherImpactLabel(weather.impact);

    const cards =
        document.querySelectorAll('aside .card');

    for (const card of cards) {
        const eyebrow =
            card.querySelector('.eyebrow');

        if (!eyebrow || !/SIMULATED WEATHER/i.test(eyebrow.textContent)) {
            continue;
        }

        const title = card.querySelector('h2');
        const detail = card.querySelector('p');

        if (title) {
            title.textContent =
                `${currentStation} \u2022 ${weather.condition}`;
        }

        if (detail) {
            detail.innerHTML =
                `${impactLabel} \u00b7 Estimated running-time impact: ` +
                `<b>+${weather.impact} min</b>`;
        }

        return;
    }
}


// ============================================================
// TIME HELPERS
// ============================================================

function formatTime(value) {

  // If already formatted like "04:40 PM"
  if (/[AP]M/i.test(value)) {
    return value;
  }

  const [hours, minutes] =
    value.split(':').map(Number);

  const ap =
    hours >= 12 ? 'PM' : 'AM';

  const hour =
    hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, '0')} ${ap}`;
}


function minutesFromTime(value) {

  const [hours, minutes] =
    value.split(':').map(Number);

  return hours * 60 + minutes;
}


function addMinutesToTime(timeValue, extraMinutes) {

  let total =
    minutesFromTime(timeValue) + extraMinutes;

  total =
    ((total % 1440) + 1440) % 1440;

  const hours =
    Math.floor(total / 60);

  const minutes =
    total % 60;

  const ap =
    hours >= 12 ? 'PM' : 'AM';

  const hour =
    hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, '0')} ${ap}`;
}
function formatArrivalTime(date) {
    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}


// Identity of one ML prediction: train + section + every value the
// backend derived from operator inputs. A tick that refetches the
// identical response reuses the anchor; anything different (new
// section, new delay/congestion/event, new ML value) re-anchors.
function predictionKey(trainId, currentStation, nextStation, ml) {
    return [
        trainId, currentStation, nextStation,
        ml.predicted_remaining_time_min,
        ml.operational_override_applied,
        ml.current_delay_min,
        ml.congestion_score,
        ml.event_type,
        ml.operator_note
    ].join('|');
}


// Resolve the display arrival + countdown from the anchor store.
// Returns { arrivalDate, displayRemaining } where arrivalDate is
// the fixed timestamp and displayRemaining counts down with the
// wall clock since the prediction was received.
function resolveAnchoredEta(trainId, currentStation, nextStation, ml, mlRemainingMinutes) {
    if (ml && mlRemainingMinutes !== null) {
        const key = predictionKey(trainId, currentStation, nextStation, ml);
        if (!anchoredPrediction || anchoredPrediction.key !== key) {
            const receivedAt = Date.now();
            anchoredPrediction = {
                key: key,
                trainId: trainId,
                currentStation: currentStation,
                nextStation: nextStation,
                receivedAt: receivedAt,
                remainingMinutes: mlRemainingMinutes,
                arrivalTimestamp: receivedAt + mlRemainingMinutes * 60 * 1000
            };
        }
    } else if (
        anchoredPrediction &&
        (anchoredPrediction.trainId !== trainId ||
            anchoredPrediction.currentStation !== currentStation ||
            anchoredPrediction.nextStation !== nextStation)
    ) {
        // Backend unreachable AND section changed: a stale anchor
        // would point at the wrong section, so drop it.
        anchoredPrediction = null;
    }

    if (!anchoredPrediction) {
        return { arrivalDate: null, displayRemaining: mlRemainingMinutes };
    }

    const elapsedMin = Math.max(
        0,
        (Date.now() - anchoredPrediction.receivedAt) / 60000
    );
    return {
        arrivalDate: new Date(anchoredPrediction.arrivalTimestamp),
        displayRemaining: Math.max(
            0,
            Math.round((anchoredPrediction.remainingMinutes - elapsedMin) * 100) / 100
        )
    };
}


// Scheduled travel duration of one route leg in minutes,
// with overnight rollover (e.g. 23:40 -> 00:20 = 40 min).
function scheduleLegMinutes(fromScheduled, toScheduled) {
    return (
        ((minutesFromTime(toScheduled) - minutesFromTime(fromScheduled)) % 1440 + 1440) % 1440
    );
}


// Projected arrivals for the next station onward, chained
// forward from the single ML arrival so the timeline always
// moves forward in route order. No extra /predict calls.
function buildProjectedArrivals(stops, nextIndex, nextArrivalDate) {
    const arrivals = new Array(stops.length).fill(null);
    arrivals[nextIndex] = new Date(nextArrivalDate.getTime());

    for (let i = nextIndex; i < stops.length - 1; i++) {
        const leg = scheduleLegMinutes(
            stops[i].scheduled,
            stops[i + 1].scheduled
        );
        arrivals[i + 1] = new Date(
            arrivals[i].getTime() + leg * 60 * 1000
        );
    }

    return arrivals;
}


// Format a projected Date like the ETA card, with a +Nd suffix
// when it falls on a later calendar day (overnight journeys).
function formatProjected(date, anchorDate) {
    const text = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    const startOfDay = value => {
        const copy = new Date(value);
        copy.setHours(0, 0, 0, 0);
        return copy.getTime();
    };

    const dayDiff = Math.round(
        (startOfDay(date) - startOfDay(anchorDate)) / 86400000
    );

    return dayDiff > 0 ? `${text} +${dayDiff}d` : text;
}


// Backend congestion_score (0-1) back to an operator label.
// Thresholds match the backend Low/Medium/High mapping.
function opsCongestionLabel(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) {
        return "";
    }
    if (value < 0.225) {
        return "Low";
    }
    if (value < 0.475) {
        return "Medium";
    }
    return "High";
}

// ============================================================
// CALCULATE DELAY FOR EACH STATION
// ============================================================
async function predictSection(trainNo, currentStation, nextStation) {
    try {
        const response = await fetch(
            "http://127.0.0.1:8000/predict",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    train_no: Number(trainNo),
                    current_station: currentStation,
                    next_station: nextStation
                })
            }
        );

        if (!response.ok) {
            console.error(
                "Prediction request failed:",
                response.status,
                trainNo,
                currentStation,
                nextStation
            );
            return null;
        }

        return await response.json();

    } catch (error) {
        console.error("ML prediction error:", error);
        return null;
    }
}
function getStationDelay(train, index, currentIndex) {

  /*
    The train's current predicted delay is the starting delay.

    As the train moves downstream, we add a small propagation
    amount of 3 minutes per section.

    Example:

    Current delay = 16 min

    Current station  → +16
    Next station     → +19
    Next station      → +22
    Next station      → +25
  */

  const downstreamDistance =
    Math.max(0, index - currentIndex);

  return Math.max(
    0,
    train.predictedDelay +
    downstreamDistance * 3
  );
}


// ============================================================
// RENDER TRAIN
// ============================================================

async function renderTrain() {

    const mySeq = ++renderSeq;

    const t =
        RailETA.getTrain(selectedId);

    if (!t) {
        return;
    }

    const stops =
        t.stops || [];

    if (!stops.length) {
        return;
    }

    // Determine current/next station from simulated train state.
    // currentIndex is derived from the train's position along its route.
    const currentIndex =
        Math.min(
            stops.length - 1,
            Math.max(
                0,
                Math.ceil(t.position || 0)
            )
        );

    const nextIndex =
        Math.min(
            stops.length - 1,
            currentIndex + 1
        );

    const atDestination = currentIndex >= stops.length - 1;

    const currentStation =
        stationMap[stops[currentIndex].station] || stops[currentIndex].station;

    const nextStation = atDestination
        ? null
        : (stationMap[stops[nextIndex].station] || stops[nextIndex].station);

    // Single ML call for the CURRENT section only.
    // predicted_remaining_time_min = remaining journey time from current state.
    // It must NOT be summed across sections.
    // At the destination there is no next station, so the ML
    // card predicts the final section actually traversed;
    // display (badges, timeline, status) still uses currentIndex.
    const hasFinalSection = stops.length >= 2;

    const predCurrentStation = atDestination
        ? (hasFinalSection
            ? (stationMap[stops[stops.length - 2].station] || stops[stops.length - 2].station)
            : null)
        : currentStation;

    const predNextStation = atDestination
        ? (hasFinalSection
            ? (stationMap[stops[stops.length - 1].station] || stops[stops.length - 1].station)
            : null)
        : nextStation;

    let mlPrediction = null;

    if (predNextStation) {
        mlPrediction = await predictSection(
            t.id,
            predCurrentStation,
            predNextStation
        );

        if (mlPrediction) {
            console.log("ML Prediction:", mlPrediction);
        }
    }

    // Drop stale responses: a newer render started while we awaited.
    if (mySeq !== renderSeq) {
        return;
    }

    const mlRemainingMinutes =
        mlPrediction && Number.isFinite(Number(mlPrediction.predicted_remaining_time_min))
            ? Number(mlPrediction.predicted_remaining_time_min)
            : null;

    // Anchored ETA: fixed at prediction time, never recomputed from
    // the live clock. Ticks reuse the stored timestamp; the countdown
    // decreases while the arrival stays put until a NEW prediction.
    const anchoredEta = resolveAnchoredEta(
        t.id, currentStation, nextStation, mlPrediction, mlRemainingMinutes
    );

    const mlArrival =
        anchoredEta.arrivalDate !== null
            ? formatArrivalTime(anchoredEta.arrivalDate)
            : t.eta;


    // Single source of truth for the whole page: the one ML
    // arrival for the current section, plus downstream stations
    // projected forward with scheduled leg durations. Absolute
    // Dates (not clock strings) keep overnight legs chronological.
    // Chained from the ANCHORED arrival so the timeline is stable
    // between predictions too.
    const nextArrivalDate =
        (anchoredEta.arrivalDate !== null && nextStation)
            ? new Date(anchoredEta.arrivalDate.getTime())
            : null;

    const projectedArrivals =
        nextArrivalDate
            ? buildProjectedArrivals(stops, nextIndex, nextArrivalDate)
            : null;


    // Snapshot the authoritative state for explanation UI.
    lastPredictionState = {
        remainingMinutes: mlRemainingMinutes,
        displayRemaining: anchoredEta.displayRemaining,
        arrival: mlArrival,
        anchoredAt: anchoredPrediction ? anchoredPrediction.receivedAt : null,
        requested: !!nextStation,
        overrideApplied: !!(mlPrediction && mlPrediction.operational_override_applied),
        currentDelay: mlPrediction ? Number(mlPrediction.current_delay_min) : null,
        congestionScore: mlPrediction ? Number(mlPrediction.congestion_score) : null,
        eventType: (mlPrediction && mlPrediction.event_type) || "",
        operatorNote: (mlPrediction && mlPrediction.operator_note) || "",
        currentStation: currentStation,
        nextStation: nextStation
    };


  // ----------------------------------------------------------
  // PAGE TITLE
  // ----------------------------------------------------------

  document.title =
    `${t.id} ${t.name} — RailSync`;


  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  const headerTitle =
    document.querySelector('.route-header h1');

  if (headerTitle) {

    headerTitle.textContent =
      `🚆 ${t.id} ${t.name}`;

  }


  const headerSubtitle =
    document.querySelector('.route-header div');

  if (headerSubtitle) {

    headerSubtitle.textContent =
      `${t.from} → ${t.to} · Live schedule reacts to your current time`;

  }


  // ----------------------------------------------------------
  // CURRENT STATUS
  // ----------------------------------------------------------

  document.getElementById('status').innerHTML = [

    [
      'CURRENT LOCATION',
      t.location
    ],

    [
      'CURRENT SPEED',
      `${t.speed} km/h`
    ],

    [
      'CURRENT DELAY',
      `+${t.delay} min`
    ],

    [
      'STATUS',
      t.status
    ]

  ]
    .map(item => `

      <div>

        <span>${item[0]}</span>

        <strong>${item[1]}</strong>

      </div>

    `)
    .join('');


  // ----------------------------------------------------------
  // ETA CARD
  // ----------------------------------------------------------

  document.getElementById('eta').innerHTML = `

    <span class="label">
      AI PREDICTED ARRIVAL

    <div class="eta-time">
    ${mlArrival}
</div>

    <div class="eta-meta">

      <div>

        <span>
          Scheduled Arrival
        </span>

        <strong>
          ${t.scheduled}
        </strong>

      </div>


      <div>
    <span>
        ML Remaining Time
    </span>

    <strong>
        ${
            anchoredEta.displayRemaining !== null
                ? `${anchoredEta.displayRemaining} min`
                : "Unavailable"
        }
    </strong>
</div>


      ${
          mlPrediction && mlPrediction.operational_override_applied
              ? `
      <div>
        <span>
          Operational delay
        </span>
        <strong>
          +${mlPrediction.current_delay_min} min · ${opsCongestionLabel(mlPrediction.congestion_score)} congestion
        </strong>
      </div>
      ` +
      (mlPrediction.event_type
          ? `
      <div>
        <span>
          Reason
        </span>
        <strong>
          ${mlPrediction.event_type}
        </strong>
      </div>
      `
          : '')
              : ''
      }


      <div>

        <span>
          Confidence
        </span>

        <strong>
          ${Math.round(t.confidence)}% · ${t.risk}
        </strong>

      </div>

    </div>


    <p style="
      font-size:12px;
      color:#c2d1f3;
      margin:15px 0 0;
    ">

      Departure:
      ${formatTime(t.stops[0].scheduled)}

      · Delay is measured against the scheduled timetable

    </p>

  `;


  // ==========================================================
  // STATIONS (currentIndex/nextIndex already derived above)
  // ==========================================================

  // ----------------------------------------------------------
  // UPCOMING STATIONS
  // ----------------------------------------------------------
  // NOTE: ML output is remaining journey time for the CURRENT
  // section only. Do NOT sum per-section predictions. The final
  // destination uses the ML arrival; intermediate stations keep
  // the existing mock-delay display.

document.getElementById('timeline').innerHTML =
    stops
        .map((stop, index) => {

            const isCurrent =
                index === currentIndex;

            const isNext =
                index === nextIndex;

            const isPassed =
                index < currentIndex;

            let predictedTime =
                formatTime(stop.scheduled);

            let stationDelay = 0;

            // Already passed stations
            if (isPassed) {

                stationDelay =
                    getStationDelay(
                        t,
                        index,
                        currentIndex
                    );

                predictedTime =
                    addMinutesToTime(
                        stop.scheduled,
                        stationDelay
                    );
            }

            // Future stations: chained forward from the single ML
            // arrival using scheduled leg durations. This is exactly
            // scheduled arrival + ML-derived shift (verified), so the
            // immediate next station is the ML prediction and later
            // stations are ML-adjusted projections, always chronological.
            else if (index > currentIndex && projectedArrivals && projectedArrivals[index]) {

                predictedTime =
                    formatProjected(
                        projectedArrivals[index],
                        projectedArrivals[nextIndex]
                    );

            }

            let classes = 'stop';

            if (isPassed) {
                classes += ' passed';
            }

            if (isCurrent) {
                classes += ' current';
            }

            let tag = '';

            if (isCurrent) {
                tag =
                    `<span class="tag">CURRENT</span>`;
            }
            else if (isNext) {
                tag =
                    `<span class="tag">NEXT</span>`;
            }

            let description;

            if (isPassed) {

                description = `
                    <div>
                        Scheduled:
                        ${formatTime(stop.scheduled)}
                    </div>

                    <div>
                        Actual / Recorded delay:
                        <strong>
                            +${Math.max(0, stationDelay)} min
                        </strong>
                    </div>
                `;

            } else if (isCurrent) {

                description = `
                    <div>
                        Scheduled:
                        ${formatTime(stop.scheduled)}
                    </div>

                    <div>
                        Current location
                    </div>

                    <div>
                        Next section:
                        <strong>
                            ${stop.station} →
                            ${stops[index + 1]?.station || "Destination"}
                        </strong>
                    </div>
                `;

            } else {

                const isMlNextStation =
                    index === nextIndex &&
                    projectedArrivals &&
                    projectedArrivals[index];

                description = `
                    <div>
                        Scheduled:
                        ${formatTime(stop.scheduled)}
                    </div>

                    <div>
                        ${isMlNextStation ? 'AI Predicted' : 'Projected'}:
                        <strong>
                            ${predictedTime}
                        </strong>
                    </div>

    <div>
    ${
        isMlNextStation
            ? `ML prediction:
               <strong>AI powered</strong>`
            : `Projection:
               <strong>ML-adjusted</strong>`
    }
</div>
                `;
            }

            return `
                <div class="${classes}">

                    <h4>
                        ${stop.station}
                        ${tag}
                    </h4>

                    <p>
                        ${description}
                    </p>

                </div>
            `;
        })
        .join('');

  // ==========================================================
  // DELAY PROPAGATION
  // ==========================================================

  document.getElementById('propagation').innerHTML =

    stops
      .map((stop, index) => {

        const stationDelay =
          getStationDelay(
            t,
            index,
            currentIndex
          );


        let predictedTime =
    addMinutesToTime(
        stop.scheduled,
        stationDelay
    );

// Stations from the next one onward share the timeline's
// projected chain so propagation agrees with the main ETA.
if (projectedArrivals && index >= nextIndex && projectedArrivals[index]) {
    predictedTime =
        formatProjected(
            projectedArrivals[index],
            projectedArrivals[nextIndex]
        );
}


        return `

          <div class="propagation-stop">

            <span style="
              display:block;
              font-size:13px;
              margin-bottom:5px;
            ">
              ${stop.station}
            </span>


            <small style="
              display:block;
              color:#6b7d9d;
              font-size:11px;
              margin-bottom:4px;
            ">
              Scheduled ${formatTime(stop.scheduled)}
            </small>


            <strong>
              ${predictedTime}
            </strong>


            <small style="
              display:block;
              color:#6b7d9d;
              font-size:11px;
              margin-top:3px;
            ">
              +${stationDelay} min delay
            </small>

          </div>


          ${
            index < stops.length - 1
              ? '<i class="fa-solid fa-arrow-right"></i>'
              : ''
          }

        `;

      })
      .join('');


  // ==========================================================
  // ETA NOTICE
  // ==========================================================

  const notice =
    document.querySelector('#etaNotice span');


  if (notice) {

    // Same ML-derived arrival as the main AI card.
    const predictedArrival = mlArrival;

notice.textContent =
    `Train ${t.id} is currently near ${stops[currentIndex].station}; ` +
    (nextStation
        ? `Next section: ${currentStation} → ${nextStation}; AI predicted arrival is ${predictedArrival}.`
        : `AI predicted arrival is ${predictedArrival}.`);

  }


  // ==========================================================
  // SIMULATED WEATHER FEED (follows current station)
  // ==========================================================

  paintWeatherCard(currentStation);

}


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    // Initial rendering

    renderTrain();


    // Initial map

    drawRailMap(
      'map',
      false,
      selectedId
    );


    // ========================================================
    // DEMO SCENARIOS
    // ========================================================

    document
      .querySelectorAll('[data-s]')
      .forEach(button => {

        button.onclick = () => {

          // Remove active state

          document
            .querySelectorAll('[data-s]')
            .forEach(x =>
              x.classList.remove('active')
            );


          // Activate clicked button

          button.classList.add('active');


          // Track the demo/what-if scenario for explanation UI.
          // This only changes the mock simulation, never the ML input.

          activeDemoScenario = button.textContent.trim();


          // Show recalculating message

          const notice =
            document.querySelector('#etaNotice');


          notice.className =
            'notice blue';


          notice.querySelector('span').textContent =
            '🔄 Recalculating ETA…';


          // Simulate scenario

          setTimeout(() => {

            RailETA.simulateScenario(
              button.dataset.s,
              selectedId
            );


            renderTrain();


            drawRailMap(
              'map',
              false,
              selectedId
            );


            UI.toast(
              'Prediction updated'
            );

          }, 450);

        };

      });


    // ========================================================
    // WHY DID ETA CHANGE?
    // ========================================================
    document
      .getElementById('why')
      .onclick = () => {

        const train =
          RailETA.getTrain(selectedId);

        const state = lastPredictionState || {};


        // Build the explanation from the actual prediction state
        // used for this render — never hardcoded mock values.

        let sourceText;
        let reasonText;

        if (!state.requested) {

          sourceText =
            'Schedule (train at destination)';

          reasonText =
            'The train has reached its destination; no live prediction is required.';

        } else if (state.remainingMinutes === null ||
                   state.remainingMinutes === undefined) {

          sourceText =
            'Unavailable (backend unreachable)';

          reasonText =
            'The FastAPI backend could not be reached, so no ML prediction is shown.';

        } else if (state.overrideApplied) {

          sourceText =
            'FastAPI ML model (operational override)';

          const delayPart =
            `operational delay +${state.currentDelay} min`;

          const congestionPart =
            `${opsCongestionLabel(state.congestionScore)} congestion`;

          const sectionPart =
            `${state.currentStation} → ${state.nextStation}`;

          reasonText =
            `ETA reflects the operator-reported ${delayPart} and ` +
            `${congestionPart} on the ${sectionPart} section` +
            (state.eventType ? ` (${state.eventType})` : '') +
            '.';

        } else {

          sourceText =
            'FastAPI ML model (baseline)';

          reasonText =
            'No operational override is stored for the ' +
            `${state.currentStation} → ${state.nextStation} section, ` +
            'so the ETA uses baseline timetable data.';
        }


        const demoText =
          activeDemoScenario && activeDemoScenario !== 'Normal Operation'
            ? `${activeDemoScenario} (mock simulation only — does not change the ML input)`
            : 'None';


        UI.modal(
          'analysis',

          `


            <h2>
              ETA CHANGE ANALYSIS
            </h2>


            <p class="muted">

              The AI-predicted arrival is the ML model's predicted
              remaining time for the current section, added to the
              current time. The operational delay is already inside
              the ML prediction and is not added again.

            </p>


            <table>

              <tr>

                <td>
                  Current section
                </td>

                <td>
                  <b>
                    ${state.currentStation || '—'} → ${state.nextStation || '—'}
                  </b>
                </td>

              </tr>


              <tr>

                <td>
                  Operational delay
                </td>

                <td>
                  <b>
                    ${
                        state.overrideApplied
                            ? `+${state.currentDelay} min`
                            : 'None (baseline)'
                    }
                  </b>
                </td>

              </tr>


              <tr>

                <td>
                  Congestion
                </td>

                <td>
                  ${
                      state.overrideApplied
                          ? opsCongestionLabel(state.congestionScore)
                          : 'Baseline'
                  }
                </td>

              </tr>


              <tr>

                <td>
                  ML remaining time
                </td>

                <td>
                  <b>
                    ${
                        state.remainingMinutes === null ||
                        state.remainingMinutes === undefined
                            ? 'Unavailable'
                            : `${state.remainingMinutes} min`
                    }
                  </b>
                </td>

              </tr>


              <tr>

                <td>
                  Predicted arrival
                </td>

                <td>
                  <b>
                    ${state.arrival || train.eta}
                  </b>
                </td>

              </tr>


              <tr>

                <td>
                  Prediction source
                </td>

                <td>
                  ${sourceText}
                </td>

              </tr>


              <tr>

                <td>
                  Demo scenario
                </td>

                <td>
                  ${demoText}
                </td>

              </tr>


              ${
                  state.operatorNote
                      ? `
              <tr>

                <td>
                  Operator note
                </td>

                <td>
                  ${state.operatorNote}
                </td>

              </tr>
                      `
                      : ''
              }

            </table>


            <p
              class="muted"
              style="margin-top:15px"
            >

              ${reasonText}

            </p>


            <div class="actions">

              <button
                class="btn"
                data-close
              >
                Close
              </button>

            </div>

          `
        );

      };


    // ========================================================
    // LIVE REFRESH
    // ========================================================

    setInterval(() => {

      RailETA.tick();

      renderTrain();

      drawRailMap(
        'map',
        false,
        selectedId
      );

    }, 30000);

  });


// ============================================================
// SHARED STATE UPDATE (same tab)
// ============================================================

window.addEventListener(
  'railsync-update',
  renderTrain
);


// ============================================================
// OPERATOR UPDATE FROM ANOTHER TAB
// ============================================================
// The operator dashboard writes a lightweight ping to
// localStorage after every save/clear (see operations.js).
// The storage event fires in OTHER tabs, so an open train
// page refetches its prediction immediately instead of
// waiting for the next 30-second tick.

window.addEventListener('storage', event => {

  if (event.key === 'railsyncOpsPing') {
    renderTrain();
  }

});


// Refetch the prediction when the tab becomes visible again,
// so a returning user never sees a stale ETA.

document.addEventListener('visibilitychange', () => {

  if (!document.hidden) {
    renderTrain();
  }

});