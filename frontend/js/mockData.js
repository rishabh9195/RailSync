/* ============================================================
   RailSync Mock Service Layer
   Demo-only data and shared browser state
   ============================================================ */

const RailETA = (() => {

  /* ==========================================================
     TRAIN ROUTES
     ========================================================== */

  const routes = {

  '12259': [
    ['Sealdah', '16:30', [22.57, 88.37]],
    ['Asansol', '20:00', [23.68, 86.98]],
    ['Dhanbad', '21:30', [23.80, 86.43]],
    ['Gaya', '01:00', [24.80, 85.00]],
    ['DDU', '03:30', [25.26, 83.27]],
    ['New Delhi', '10:00', [28.61, 77.21]]
  ],

  '12301': [
    ['New Delhi', '16:55', [28.61, 77.21]],
    ['Kanpur', '21:42', [26.45, 80.33]],
    ['Prayagraj', '23:50', [25.44, 81.85]],
    ['DDU', '02:35', [25.26, 83.27]],
    ['Gaya', '04:51', [24.80, 85.00]],
    ['Howrah', '08:10', [22.60, 88.26]]
  ],

  '12627': [
    ['Chennai', '19:20', [13.08, 80.27]],
    ['Gudur', '00:55', [14.15, 79.85]],
    ['Nellore', '02:00', [14.44, 79.99]],
    ['Vijayawada', '06:25', [16.51, 80.65]],
    ['Warangal', '10:00', [17.98, 79.59]],
    ['Secunderabad', '13:00', [17.44, 78.50]]
  ],

  '12723': [
    ['Hyderabad', '18:00', [17.39, 78.49]],
    ['Kazipet', '20:00', [18.44, 79.13]],
    ['Warangal', '21:00', [17.98, 79.59]],
    ['Vijayawada', '01:00', [16.51, 80.65]],
    ['Gudur', '05:00', [14.15, 79.85]],
    ['Chennai', '08:00', [13.08, 80.27]]
],

  '12860': [
    ['Mumbai', '17:00', [19.08, 72.88]],
    ['Pune', '20:00', [18.52, 73.86]],
    ['Solapur', '23:30', [17.66, 75.91]],
    ['Kalaburagi', '02:00', [17.33, 76.83]],
    ['Wadi', '03:30', [17.08, 76.99]],
    ['Secunderabad', '07:00', [17.44, 78.50]]
  ],

  '12951': [
    ['Mumbai', '17:00', [19.08, 72.88]],
    ['Surat', '20:00', [21.17, 72.83]],
    ['Vadodara', '22:00', [22.31, 73.18]],
    ['Ratlam', '02:00', [23.33, 75.04]],
    ['Kota', '05:00', [25.18, 75.83]],
    ['New Delhi', '09:55', [28.61, 77.21]]
  ]

};

  /* ==========================================================
     TRAIN BASIC DATA
     ========================================================== */

  const raw = [

  [
    '12259',
    'Duronto Express',
    'Sealdah',
    'New Delhi',
    18,
    72
  ],

  [
    '12301',
    'Rajdhani Express',
    'New Delhi',
    'Howrah',
    18,
    72
  ],

  [
    '12627',
    'Karnataka Express',
    'Chennai',
    'Secunderabad',
    7,
    81
  ],

  [
    '12723',
    'Telangana Express',
    'Hyderabad',
    'Chennai',
    12,
    76
  ],

  [
    '12860',
    'Gitanjali Express',
    'Mumbai',
    'Secunderabad',
    14,
    68
  ],

  [
    '12951',
    'Mumbai Rajdhani',
    'Mumbai',
    'New Delhi',
    35,
    58
  ]

];


  /* ==========================================================
     TIME HELPERS
     ========================================================== */

  const mins = value => {

    const [h, m] =
      value.split(':').map(Number);

    return h * 60 + m;

  };


  const time = value => {

    value =
      ((value % 1440) + 1440) % 1440;

    const h =
      Math.floor(value / 60);

    const m =
      value % 60;

    const ap =
      h >= 12 ? 'PM' : 'AM';

    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;

  };


  const now = () => {

    const date = new Date();

    return (
      date.getHours() * 60 +
      date.getMinutes()
    );

  };


  /* ==========================================================
     CREATE TRAIN OBJECT
     ========================================================== */

  const makeTrain = trainData => {

    const [
      id,
      name,
      from,
      to,
      delay,
      speed
    ] = trainData;


    const stops =
      routes[id].map(
        ([station, scheduled, coords]) => ({
          station,
          scheduled,
          coords
        })
      );


    const last =
      stops[stops.length - 1];


    return {

      id,

      name,

      from,

      to,

      delay,

      predictedDelay: delay,

      eta:
        time(
          mins(last.scheduled) +
          delay
        ),

      scheduled:
        time(
          mins(last.scheduled)
        ),

      departure:
        time(
          mins(stops[0].scheduled)
        ),

      risk:
        delay >= 28
          ? 'High'
          : delay < 9
            ? 'Low'
            : 'Medium',

      confidence:
        Math.max(
          76,
          94 - delay / 2
        ),

      status: 'Running',

      speed,

      stops,

      position: 0.05,

      location: from

    };

  };


  /* ==========================================================
     INITIAL STATE (versioned to prevent stale routes)
     ========================================================== */

  const ROUTE_DATA_VERSION = 'v4';

  const defaultState = () => ({

      trains:
        raw.map(makeTrain),

      events: [

        {
          id: 1,
          type: 'Platform Congestion',
          location: 'DDU',
          severity: 'Medium',
          duration: 25,
          affected: 4,
          status: 'Active'
        },

        {
          id: 2,
          type: 'Heavy Rain',
          location: 'Gaya Jn',
          severity: 'High',
          duration: 40,
          affected: 6,
          status: 'Active'
        }

      ],

      alerts: [

        {
          icon: '⚠',
          title: 'ETA Updated',
          text:
            'Train 12301 forecast was updated based on network congestion.',
          time: '2 minutes ago'
        },

        {
          icon: '🌧',
          title: 'Weather Alert',
          text:
            'Weather conditions are being monitored along the route.',
          time: '10 minutes ago'
        }

      ]

    });


  const loadState = () => {
    try {
      const rawSaved =
        JSON.parse(
          localStorage.getItem(
            'railsyncRouteState'
          ) || 'null'
        );

      if (!rawSaved) {
        return defaultState();
      }

      // New versioned format: { v, state }
      if (rawSaved.v === ROUTE_DATA_VERSION && rawSaved.state) {
        // Stored trains must carry the fields every renderer
        // depends on (id + name) and match a known route.
        // Anything else (legacy shape, partial write, state from
        // another copy of the project on the same origin) is
        // discarded so cards never render blank/undefined names.
        const stored = rawSaved.state.trains;
        const valid =
          Array.isArray(stored) &&
          stored.length > 0 &&
          stored.every(train =>
            train &&
            String(train.id || '').trim() !== '' &&
            String(train.name || '').trim() !== '' &&
            Array.isArray(train.stops) &&
            routes[String(train.id)]
          );

        if (valid) {
          return rawSaved.state;
        }
      }

      // Old unversioned format, stale version or invalid
      // stored trains: discard and rebuild from raw data
      return defaultState();
    } catch (e) {
      return defaultState();
    }
  };


  let state = loadState();


  /* ==========================================================
     TRAIN REFRESH
     ========================================================== */

  const refresh = train => {

    const first =
      mins(
        train.stops[0].scheduled
      );


    let last =
      mins(
        train.stops[
          train.stops.length - 1
        ].scheduled
      );


    if (last <= first) {

      last += 1440;

    }


    let current =
      now();


    if (current < first - 180) {

      current += 1440;

    }


    const p =
      Math.max(
        0.01,
        Math.min(
          0.98,
          (current - first) /
          (last - first)
        )
      );


    train.position =
      p *
      (train.stops.length - 1);


    const index =
      Math.min(
        train.stops.length - 1,
        Math.ceil(train.position)
      );


    train.location =
      train.stops[index].station;


    train.status =
      current < first
        ? 'Awaiting departure'
        : current > last
          ? 'Arrived'
          : train.delay > 25
            ? 'Running Late'
            : 'Running';


    train.eta =
      time(
        mins(
          train.stops[
            train.stops.length - 1
          ].scheduled
        ) +
        train.predictedDelay
      );

  };


  /* ==========================================================
     SAVE STATE
     ========================================================== */

  const sync = () => {

    state.trains.forEach(refresh);

  };


  const save = () => {

    sync();


    localStorage.setItem(
      'railsyncRouteState',
      JSON.stringify({
        v: ROUTE_DATA_VERSION,
        state
      })
    );


    window.dispatchEvent(
      new Event('railsync-update')
    );

  };


  /* ==========================================================
     EVENT DELAY IMPACT
     ========================================================== */

  const getEventImpact = event => {

    const impactByType = {

      'Signal Failure': 18,

      'Heavy Congestion': 15,

      'Speed Restriction': 10,

      'Heavy Rain': 8,

      'Platform Congestion': 7,

      'Track Obstruction': 20,

      'Other Operational Issue': 12

    };


    let impact =
      impactByType[event.type] ?? 10;


    if (event.severity === 'High') {

      impact += 7;

    }


    if (event.severity === 'Low') {

      impact =
        Math.max(
          3,
          impact - 4
        );

    }


    return impact;

  };


  /* ==========================================================
     ADD OPERATIONAL EVENT
     ========================================================== */

  const addEvent = event => {

    /* --------------------------------------------------------
       Create unique ID
       -------------------------------------------------------- */

    event.id =
      Date.now();


    event.status =
      'Active';


    /* --------------------------------------------------------
       Find affected trains
       -------------------------------------------------------- */

    const affectedTrains =
      state.trains.filter(train => {

        return train.stops.some(stop => {

          return (
            stop.station === event.location ||
            stop.station.includes(event.location) ||
            event.location.includes(stop.station)
          );

        });

      });


    /* --------------------------------------------------------
       Calculate delay impact
       -------------------------------------------------------- */

    const impact =
      getEventImpact(event);


    event.impact =
      impact;


    event.affected =
      affectedTrains.length;


    event.affectedTrainIds =
      affectedTrains.map(
        train => train.id
      );


    /* --------------------------------------------------------
       Apply delay to affected trains
       -------------------------------------------------------- */

    affectedTrains.forEach(train => {

      train.delay += impact;

      train.predictedDelay += impact;


      train.risk =
        train.predictedDelay >= 28
          ? 'High'
          : train.predictedDelay < 9
            ? 'Low'
            : 'Medium';


      train.eta =
        time(
          mins(
            train.stops[
              train.stops.length - 1
            ].scheduled
          ) +
          train.predictedDelay
        );

    });


    /* --------------------------------------------------------
       Add event to active events
       -------------------------------------------------------- */

    state.events.unshift(event);


    /* --------------------------------------------------------
       Add passenger alert
       -------------------------------------------------------- */

    state.alerts.unshift({

      icon:
        event.type === 'Heavy Rain'
          ? '🌧'
          : '⚠',

      title:
        `${event.type} at ${event.location}`,

      text:
        `${event.type} is expected to cause approximately +${impact} min delay for affected trains.`,

      time:
        'Just now'

    });


    /* --------------------------------------------------------
       Keep alerts limited
       -------------------------------------------------------- */

    if (state.alerts.length > 20) {

      state.alerts =
        state.alerts.slice(0, 20);

    }


    /* --------------------------------------------------------
       Save shared state
       -------------------------------------------------------- */

    save();


    return event;

  };


  /* ==========================================================
     RESOLVE EVENT
     ========================================================== */

  const resolveEvent = id => {

    const event =
      state.events.find(
        item => String(item.id) === String(id)
      );


    if (!event) {

      return;

    }


    /* --------------------------------------------------------
       Remove event impact from affected trains
       -------------------------------------------------------- */

    const impact =
      Number(event.impact || 0);


    const affectedIds =
      event.affectedTrainIds || [];


    state.trains.forEach(train => {

      if (
        affectedIds.includes(train.id)
      ) {

        train.delay =
          Math.max(
            0,
            train.delay - impact
          );


        train.predictedDelay =
          Math.max(
            0,
            train.predictedDelay - impact
          );


        train.risk =
          train.predictedDelay >= 28
            ? 'High'
            : train.predictedDelay < 9
              ? 'Low'
              : 'Medium';


        train.eta =
          time(
            mins(
              train.stops[
                train.stops.length - 1
              ].scheduled
            ) +
            train.predictedDelay
          );

      }

    });


    /* --------------------------------------------------------
       Mark event resolved
       -------------------------------------------------------- */

    event.status =
      'Resolved';


    /* --------------------------------------------------------
       Save
       -------------------------------------------------------- */

    save();

  };


  /* ==========================================================
     SCENARIO SIMULATION
     ========================================================== */

  const simulateScenario = (type, trainId) => {

    const train =
      (trainId &&
        state.trains.find(
          item => String(item.id) === String(trainId)
        )) ||
      state.trains[0];


    const impactMap = {

      normal: 0,

      '5': 5,

      '10': 10,

      '15': 15,

      signal: 18,

      speed: 10,

      rain: 8,

      platform: 7,

      heavy: 25,

      event: 12,

      clear: -10

    };


    const impact =
      impactMap[type] ?? 0;


    train.predictedDelay =
      Math.max(
        0,
        18 + impact
      );


    train.delay =
      train.predictedDelay;


    train.risk =
      train.delay >= 28
        ? 'High'
        : train.delay < 9
          ? 'Low'
          : 'Medium';


    train.eta =
      time(
        mins(
          train.stops[
            train.stops.length - 1
          ].scheduled
        ) +
        train.predictedDelay
      );


    /* --------------------------------------------------------
       Clear Events scenario
       -------------------------------------------------------- */

    if (type === 'clear') {

      state.events.forEach(
        event => {
          event.status = 'Resolved';
        }
      );

    }


    save();


    return {

      impact,

      train

    };

  };


  /* ==========================================================
     PUBLIC API
     ========================================================== */

  return {

    getTrains: () => {

      sync();

      return state.trains;

    },


    getTrain: id => {

      sync();

      return (
        state.trains.find(
          train => train.id === id
        ) ||
        state.trains[0]
      );

    },


    getLiveTrainStatus: id => {

      return RailETA.getTrain(id);

    },


    getPredictedETA: id => {

      return RailETA.getTrain(id);

    },


    getEvents: () => {

      return state.events.filter(
        event =>
          event.status === 'Active'
      );

    },


    getAlerts: () => {

      return state.alerts;

    },


    getStations: (trainId) => {

      const key =
        (trainId && routes[String(trainId)])
          ? String(trainId)
          : '12301';

      return routes[key].map(
        ([name, , coords]) => ({
          name,
          coords
        })
      );

    },


    addEvent: addEvent,


    resolveEvent: resolveEvent,


    simulateScenario:
      simulateScenario,


    // Single source for Network Overview dashboard cards.
    // Delayed = current delay above zero (existing mock delay
    // semantics); risk bands reuse the same predictedDelay
    // thresholds as makeTrain/refresh (High >= 28, Low < 9);
    // active events are unresolved records only. Backend ML
    // overrides are intentionally excluded here: they affect
    // train-page ETA/alerts, while these bands describe the
    // shared simulated train state every page already uses.
    getNetworkStats: () => {

      sync();

      const trains = state.trains;

      const delayed = trains.filter(
        train => Number(train.delay) > 0
      ).length;

      const highRisk = trains.filter(
        train => train.risk === 'High'
      ).length;

      const needAttention = trains.filter(
        train => train.risk !== 'Low'
      ).length;

      const activeEvents = state.events.filter(
        event => event.status === 'Active'
      ).length;

      return {
        activeTrains: trains.length,
        delayed: delayed,
        highRisk: highRisk,
        needAttention: needAttention,
        activeEvents: activeEvents
      };

    },


    tick: () => {

      save();

    }

  };

})();