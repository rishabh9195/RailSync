/* ============================================================
   RailSync Operator ML input (FastAPI operational state)

   Sends per-train/per-section delay + congestion to the
   backend, where /predict applies them to the trained model.
   Same API origin as the passenger prediction call.
   ============================================================ */

const RAILSYNC_API_BASE = 'http://127.0.0.1:8000';


function opsApi(path, options) {
    return fetch(RAILSYNC_API_BASE + path, options);
}


// Notify open train pages (other tabs) that operational state
// changed. The storage event fires in other tabs only, where
// train.js listens for this key and refetches its prediction.
function pingTrainPage(entry) {
    try {
        localStorage.setItem(
            'railsyncOpsPing',
            JSON.stringify(Object.assign({ ts: Date.now() }, entry))
        );
    } catch (e) {
        /* storage unavailable: train page still updates on its tick */
    }
}


function opsTrainOptions() {
    return RailETA.getTrains().map(t =>
        `<option value="${t.id}">${t.id} ${t.name}</option>`
    ).join('');
}


function opsSectionOptions(trainId) {
    const train = RailETA.getTrain(String(trainId));
    if (!train || !train.stops) {
        return '';
    }
    return train.stops.slice(0, -1).map((stop, i) =>
        `<option value="${stop.station}|${train.stops[i + 1].station}">` +
        `${stop.station} → ${train.stops[i + 1].station}</option>`
    ).join('');
}


async function refreshOpsState() {
    const trainId = document.getElementById('opsTrain')?.value;
    const box = document.getElementById('opsState');
    if (!trainId || !box) {
        return;
    }

    renderOpsContext(trainId);

    let data = null;
    try {
        const res = await opsApi(`/operations/${encodeURIComponent(trainId)}`);
        if (res.ok) {
            data = await res.json();
        }
    } catch (e) {
        /* backend offline: show empty state below */
    }

    const sections = (data && data.sections) || [];

    if (!sections.length) {
        box.innerHTML = `<tr><td colspan="5" class="muted">No operator overrides for this train. Predictions use baseline data.</td></tr>`;
        return;
    }

    // Live ML prediction per saved section, fetched from FastAPI
    // (real model output — never fabricated). One request per
    // saved section of the selected train only.
    const preds = await Promise.all(sections.map(async s => {
        try {
            const res = await opsApi('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    train_no: Number(trainId),
                    current_station: s.current_station,
                    next_station: s.next_station
                })
            });
            if (!res.ok) {
                return null;
            }
            return await res.json();
        } catch (e) {
            return null;
        }
    }));

    box.innerHTML = sections.map((s, i) => {
        const pred = preds[i];
        const predText = pred && Number.isFinite(Number(pred.predicted_remaining_time_min))
            ? `${pred.predicted_remaining_time_min} min`
            : `<span class="muted">backend offline</span>`;
        return `
            <tr>
                <td><b>${s.current_station} → ${s.next_station}</b>` +
                    (s.event_type ? `<br><small class="muted">${s.event_type}</small>` : '') +
                `</td>
                <td>+${s.current_delay_min} min</td>
                <td>${s.congestion_label} (${s.congestion_score})</td>
                <td><b>${predText}</b></td>
                <td>
                    <button class="btn small secondary"
                        onclick="clearOpsSection('${s.current_station}', '${s.next_station}')">
                        Clear
                    </button>
                </td>
            </tr>`;
    }).join('');
}


// Which section the backend will actually use for this train
// right now (same position logic as the live-status page), so
// the operator can see whether an override applies to it.
function renderOpsContext(trainId) {
    const box = document.getElementById('opsContext');
    if (!box) {
        return;
    }
    let text = '';
    try {
        const t = RailETA.getTrain(String(trainId));
        if (t && t.stops && t.stops.length) {
            const idx = Math.min(
                t.stops.length - 1,
                Math.max(0, Math.ceil(t.position || 0))
            );
            text = idx >= t.stops.length - 1
                ? `Train ${t.id} is at its destination (${t.stops[idx].station}). Overrides apply per section on the next prediction for that section.`
                : `Train ${t.id} simulated position: ${t.stops[idx].station} → ${t.stops[idx + 1].station}. An override affects prediction only for its own section.`;
        }
    } catch (e) {
        text = '';
    }
    box.textContent = text;
}


async function submitOpsForm(form) {
    const trainId = document.getElementById('opsTrain')?.value;
    const section = document.getElementById('opsSection')?.value || '';
    const [currentStation, nextStation] = section.split('|');
    const delay = Number(document.getElementById('opsDelay')?.value);
    const congestion = document.getElementById('opsCongestion')?.value;
    const eventType = document.getElementById('opsEvent')?.value || '';
    const note = document.getElementById('opsNote')?.value.trim() || '';

    if (!trainId || !currentStation || !nextStation) {
        UI.toast('Select a train and section');
        return false;
    }
    if (!Number.isFinite(delay) || delay < -10 || delay > 120) {
        UI.toast('Delay must be between -10 and 120 minutes');
        return false;
    }

    try {
        const res = await opsApi('/operations/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                train_no: Number(trainId),
                current_station: currentStation,
                next_station: nextStation,
                current_delay_min: delay,
                congestion: congestion,
                event_type: eventType,
                operator_note: note
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            UI.toast(err.detail || 'Update rejected by backend');
            return false;
        }

        const saved = await res.json();
        UI.toast(`Operational input saved: ${saved.current_station} → ${saved.next_station}. Passenger alert updated.`);
        pingTrainPage({
            train_no: saved.train_no,
            current_station: saved.current_station,
            next_station: saved.next_station,
            cleared: false
        });
        refreshOpsState();
    } catch (e) {
        console.error('Operations update error:', e);
        UI.toast('Backend unavailable. Is FastAPI running?');
    }

    return false;
}


async function clearOpsSection(currentStation, nextStation) {
    const trainId = document.getElementById('opsTrain')?.value;
    if (!trainId) {
        return;
    }
    try {
        await opsApi('/operations/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                train_no: Number(trainId),
                current_station: currentStation,
                next_station: nextStation
            })
        });
        UI.toast('Operational override cleared');
        pingTrainPage({
            train_no: Number(trainId),
            current_station: currentStation,
            next_station: nextStation,
            cleared: true
        });
        refreshOpsState();
    } catch (e) {
        UI.toast('Backend unavailable. Is FastAPI running?');
    }
}


async function clearOpsTrain() {
    const trainId = document.getElementById('opsTrain')?.value;
    if (!trainId) {
        return false;
    }
    try {
        await opsApi('/operations/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ train_no: Number(trainId) })
        });
        UI.toast('All overrides cleared for train ' + trainId);
        pingTrainPage({
            train_no: Number(trainId),
            cleared: true
        });
        refreshOpsState();
    } catch (e) {
        UI.toast('Backend unavailable. Is FastAPI running?');
    }
    return false;
}


document.addEventListener('DOMContentLoaded', () => {
    const trainSelect = document.getElementById('opsTrain');
    const sectionSelect = document.getElementById('opsSection');
    if (!trainSelect || !sectionSelect) {
        return;
    }

    trainSelect.innerHTML = opsTrainOptions();

    const syncSections = () => {
        sectionSelect.innerHTML = opsSectionOptions(trainSelect.value);
        refreshOpsState();
    };

    trainSelect.addEventListener('change', syncSections);
    syncSections();

    window.addEventListener('railsync-update', () => {
        refreshOpsState();
    });
});
