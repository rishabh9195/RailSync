/* ============================================================
   RailSync Passenger Alerts (unified display)

   Backend operational alerts (GET /alerts, created automatically
   by POST /operations/update, keyed per train + section so
   repeat updates never duplicate) are shown first, followed by
   the existing local demo alerts from RailETA. Re-rendering
   replaces the list, so polling cannot duplicate cards.
   Same API origin as prediction + operator input.
   ============================================================ */

const RAILSYNC_ALERTS_API = 'http://127.0.0.1:8000';


async function fetchBackendAlerts() {
    try {
        const res = await fetch(RAILSYNC_ALERTS_API + '/alerts');
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        return data.alerts || [];
    } catch (e) {
        return null; // backend offline: fall back to local alerts
    }
}


function alertRelativeTime(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) {
        return 'Recently';
    }
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 60) {
        return 'Just now';
    }
    if (secs < 3600) {
        const mins = Math.floor(secs / 60);
        return mins + (mins === 1 ? ' min ago' : ' mins ago');
    }
    return new Date(then).toLocaleString([], {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
    });
}


function backendAlertCard(a) {
    let trainName = '';
    try {
        const t = RailETA.getTrain(String(a.train_no));
        if (t && String(t.id) === String(a.train_no)) {
            trainName = ' ' + t.name;
        }
    } catch (e) {
        trainName = '';
    }

    const heading = a.event_type
        ? `Train ${a.train_no}${trainName} — ${a.event_type}`
        : `Operational Alert — Train ${a.train_no}${trainName}`;

    const note = a.operator_note
        ? `<div style="margin-top:6px;font-size:12px;color:#7183a2;">Note: ${a.operator_note}</div>`
        : '';

    return `

      <article
        class="card result"
        style="
          display:flex;
          align-items:flex-start;
          gap:16px;
        "
      >

        <div
          style="
            font-size:28px;
            width:42px;
            text-align:center;
            flex-shrink:0;
          "
        >
          ⚠
        </div>


        <div
          style="
            flex:1;
            min-width:0;
          "
        >

          <h3>
            ${heading}
          </h3>

          <p>
            ${a.current_station} → ${a.next_station} ·
            +${a.delay_min} min · ${a.congestion} congestion
          </p>

          <p>
            ${a.message}
          </p>

          ${note}

          <div style="margin-top:8px">
            <a
              class="btn small secondary"
              href="train.html?id=${a.train_no}"
            >
              View live status
            </a>
          </div>

        </div>


        <small
          class="muted"
          style="
            white-space:nowrap;
          "
        >
          ${alertRelativeTime(a.updated_at)}
        </small>

      </article>

    `;
}


function localAlertCard(alert) {
    return `

      <article
        class="card result"
        style="
          display:flex;
          align-items:flex-start;
          gap:16px;
        "
      >

        <div
          style="
            font-size:28px;
            width:42px;
            text-align:center;
            flex-shrink:0;
          "
        >
          ${alert.icon}
        </div>


        <div
          style="
            flex:1;
            min-width:0;
          "
        >

          <h3>
            ${alert.title}
          </h3>

          <p>
            ${alert.text}
          </p>

        </div>


        <small
          class="muted"
          style="
            white-space:nowrap;
          "
        >
          ${alert.time}
        </small>

      </article>

    `;
}


function emptyAlertsCard(offline) {
    return `

      <article class="card result">

        <div style="font-size:30px">
          ✓
        </div>

        <div style="flex:1">

          <h3>
            No active alerts
          </h3>

          <p>
            There are currently no journey
            notifications requiring your attention.
          </p>

          ${
              offline
                  ? `<p class="muted">Live operational alerts unavailable.</p>`
                  : ''
          }

        </div>

      </article>

    `;
}


async function renderAlerts() {

  const alertsContainer =
    document.getElementById('alerts');

  if (!alertsContainer) {
    return;
  }

  // Existing local demo alerts (unchanged source)
  let localAlerts = [];
  try {
    localAlerts = RailETA.getAlerts() || [];
  } catch (e) {
    localAlerts = [];
  }

  // Live backend operational alerts (null when offline)
  const backendAlerts = await fetchBackendAlerts();

  const cards = (backendAlerts || []).map(backendAlertCard)
    .concat(localAlerts.map(localAlertCard));

  if (!cards.length) {
    alertsContainer.innerHTML = emptyAlertsCard(backendAlerts === null);
    return;
  }

  alertsContainer.innerHTML = cards.join('') + (
    backendAlerts === null
      ? `<p class="muted" style="font-size:12px">Live operational alerts unavailable.</p>`
      : ''
  );

}


// ==========================================
// INITIAL LOAD + LIGHT REFRESH
// ==========================================

document.addEventListener(
  'DOMContentLoaded',
  () => {
    renderAlerts();
    // Lightweight poll so operator updates appear without
    // a manual reload. Re-render replaces cards (no dupes).
    setInterval(renderAlerts, 30000);
  }
);


// ==========================================
// REFRESH WHEN SHARED STATE CHANGES
// ==========================================

window.addEventListener(
  'railsync-update',
  renderAlerts
);
