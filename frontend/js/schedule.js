/* ============================================================
   RailSync Train Calendar (scheduled timetable only)

   No live position, no ML prediction, no /predict calls here.
   Station order/names/times come from RailETA (mockData.js)
   so the timetable always matches the tracking routes.
   Halts, demo distances and running days below are curated
   prototype data.
   ============================================================ */

const TIMETABLE_META = {

    '12259': {
        runsOn: { monday: true, tuesday: false, wednesday: true, thursday: false, friday: true, saturday: true, sunday: false },
        halts: [0, 3, 2, 10, 5, 0],
        distances: [0, 191, 271, 489, 743, 1441]
    },

    '12301': {
        runsOn: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true },
        halts: [0, 5, 5, 10, 5, 0],
        distances: [0, 441, 627, 906, 1115, 1441]
    },

    '12627': {
        runsOn: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true },
        halts: [0, 2, 2, 5, 5, 0],
        distances: [0, 172, 203, 351, 522, 698]
    },

    '12723': {
        runsOn: { monday: true, tuesday: true, wednesday: false, thursday: true, friday: false, saturday: true, sunday: true },
        halts: [0, 2, 5, 5, 2, 0],
        distances: [0, 94, 172, 354, 543, 708]
    },

    '12860': {
        runsOn: { monday: false, tuesday: false, wednesday: true, thursday: true, friday: true, saturday: false, sunday: true },
        halts: [0, 3, 3, 2, 2, 0],
        distances: [0, 192, 377, 551, 621, 772]
    },

    '12951': {
        runsOn: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true },
        halts: [0, 5, 5, 5, 5, 0],
        distances: [0, 263, 422, 756, 943, 1386]
    }

};


// Index by Date.getDay(): 0=Sunday..6=Saturday
const WEEKDAY_BY_GETDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let selectedTrainId = '12723';
let selectedDateISO = toISODate(new Date());


/* ==========================================================
   Small helpers
   ========================================================== */

function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


function formatDateLong(iso) {
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        return iso;
    }
    return `${String(parts[2]).padStart(2, '0')} ${MONTHS[parts[1] - 1]} ${parts[0]}`;
}


function weekdayKeyForDate(iso) {
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        return null;
    }
    // Noon avoids any daylight-saving edge around midnight.
    const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    if (isNaN(date.getTime())) {
        return null;
    }
    return WEEKDAY_BY_GETDAY[date.getDay()];
}


function minsFromHM(value) {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
}


function hmFromMins(total) {
    total = ((total % 1440) + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}


function runsOnLabel(meta) {
    const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const short = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
    const days = order.filter(d => meta.runsOn[d]);
    if (days.length === 7) {
        return 'Daily';
    }
    return days.map(d => short[d]).join(', ');
}


/* ==========================================================
   Train lookup (number or name, case-insensitive)
   ========================================================== */

function findTrain(query) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) {
        return null;
    }
    return RailETA.getTrains().find(t =>
        String(t.id).trim() === needle ||
        String(t.name).toLowerCase().includes(needle)
    ) || null;
}


function findTrainForm(form) {
    const input = form.querySelector('#trainQuery');
    const train = findTrain(input ? input.value : '');

    if (!train) {
        notifyCalendar('Train not found. Try 12259, 12301, 12627, 12723, 12860 or 12951.');
        return false;
    }

    selectedTrainId = String(train.id);
    renderCalendarPage();
    return false;
}


function notifyCalendar(msg) {
    if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
        UI.toast(msg);
    } else {
        alert(msg);
    }
}


/* ==========================================================
   Schedule model built from the tracking route
   ========================================================== */

function getTrainSchedule(trainId) {
    const train = RailETA.getTrain(String(trainId));
    if (!train || !train.stops || !train.stops.length) {
        return null;
    }

    const meta = TIMETABLE_META[String(train.id)] || TIMETABLE_META['12723'];
    const stops = train.stops;
    const last = stops.length - 1;

    let day = 1;
    let prevMins = null;

    const stations = stops.map((stop, index) => {
        const arrMins = minsFromHM(stop.scheduled);

        // Overnight rollover: clock time went backwards -> next day.
        if (prevMins !== null && arrMins < prevMins) {
            day += 1;
        }
        prevMins = arrMins;

        const halt = meta.halts[index] || 0;
        const isOrigin = index === 0;
        const isDestination = index === last;

        let arrival = stop.scheduled;
        let departure = stop.scheduled;
        let depDay = day;

        if (isOrigin) {
            arrival = '--';
        } else if (!isDestination) {
            const depMins = arrMins + halt;
            departure = hmFromMins(depMins);
            if (depMins >= 1440) {
                depDay = day + 1;
            }
        }

        if (isDestination) {
            departure = '--';
        }

        return {
            sequence: index + 1,
            stationCode: stop.station,
            stationName: stop.station,
            arrival: arrival,
            departure: departure,
            haltMinutes: (isOrigin || isDestination) ? 0 : halt,
            distanceKm: meta.distances[index] || 0,
            day: day,
            arrivalDay: day,
            departureDay: depDay
        };
    });

    return {
        trainNo: String(train.id),
        name: train.name,
        origin: train.from,
        destination: train.to,
        runsOn: meta.runsOn,
        runsOnText: runsOnLabel(meta),
        stations: stations
    };
}


function isTrainRunningOnDate(trainId, isoDate) {
    const schedule = getTrainSchedule(trainId);
    if (!schedule) {
        return false;
    }
    const key = weekdayKeyForDate(isoDate);
    if (!key) {
        return false;
    }
    return !!schedule.runsOn[key];
}


/* ==========================================================
   Rendering
   ========================================================== */

function renderTrainInfo() {
    const schedule = getTrainSchedule(selectedTrainId);
    const box = document.getElementById('trainInfo');
    if (!box || !schedule) {
        return;
    }

    box.innerHTML = `
        <span class="eyebrow">SELECTED TRAIN</span>
        <h2 style="margin:4px 0">${schedule.trainNo} ${schedule.name}</h2>
        <p class="muted" style="margin:0">${schedule.origin} → ${schedule.destination}</p>
        <p style="margin:8px 0 0"><small class="muted">RUNS ON</small><br><b>${schedule.runsOnText}</b></p>
        <p style="margin:8px 0 0"><small class="muted">SELECTED DATE</small><br><b>${formatDateLong(selectedDateISO)}</b></p>
    `;
}


function renderRunningStatus() {
    const box = document.getElementById('runStatus');
    if (!box) {
        return true;
    }

    const schedule = getTrainSchedule(selectedTrainId);
    if (!schedule) {
        box.innerHTML = '';
        return false;
    }

    const key = weekdayKeyForDate(selectedDateISO);
    if (!key) {
        box.innerHTML = '<span class="tag amber">INVALID DATE</span>';
        return false;
    }

    const runs = !!schedule.runsOn[key];

    box.innerHTML = runs
        ? '<span class="tag green">RUNS ON THIS DAY</span>'
        : '<span class="tag red">DOES NOT RUN ON THIS DAY</span>';

    return runs;
}


function renderTimetable(runs) {
    const schedule = getTrainSchedule(selectedTrainId);
    const body = document.getElementById('timetableBody');
    const wrap = document.getElementById('timetableWrap');
    const note = document.getElementById('timetableNote');
    if (!body || !schedule) {
        return;
    }

    body.innerHTML = schedule.stations.map(s => `
        <tr>
            <td>${s.sequence}</td>
            <td><b>${s.stationName}</b></td>
            <td>${s.arrival}</td>
            <td>${s.departure}</td>
            <td>${s.haltMinutes ? s.haltMinutes + ' min' : '--'}</td>
            <td>${s.distanceKm} km</td>
            <td>Day ${s.arrivalDay}</td>
        </tr>
    `).join('');

    if (wrap) {
        wrap.style.opacity = runs ? '' : '0.55';
    }

    if (note) {
        note.innerHTML = runs
            ? ''
            : '<small class="muted">This train does not run on the selected day. Timetable shown for reference.</small>';
    }
}


function renderCalendarPage() {
    renderTrainInfo();
    const runs = renderRunningStatus();
    renderTimetable(runs);

    const input = document.getElementById('travelDate');
    if (input && input.value !== selectedDateISO) {
        input.value = selectedDateISO;
    }

    const query = document.getElementById('trainQuery');
    if (query && document.activeElement !== query) {
        query.value = selectedTrainId;
    }
}


function trackTrain() {
    location.href = 'train.html?id=' + encodeURIComponent(selectedTrainId);
}


/* ==========================================================
   Init
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('id');
    if (requested && findTrain(requested)) {
        selectedTrainId = String(findTrain(requested).id);
    }

    const input = document.getElementById('travelDate');
    if (input) {
        input.value = selectedDateISO;
        input.addEventListener('change', () => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) {
                selectedDateISO = input.value;
            } else {
                notifyCalendar('Please select a valid date.');
                input.value = selectedDateISO;
                return;
            }
            renderCalendarPage();
        });
    }

    renderCalendarPage();
});
