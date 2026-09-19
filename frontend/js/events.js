// ============================================================
// RAILSYNC - OPERATIONAL EVENTS
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const table = document.getElementById('eventsTable');
  const addButton = document.getElementById('add');

  // ==========================================================
  // RENDER EVENTS
  // ==========================================================

  function renderEvents() {

    const events = RailETA.getEvents();

    if (!table) return;

    // No active events

    if (!events || events.length === 0) {

      table.innerHTML = `
        <tr>
          <td
            colspan="7"
            style="
              padding:32px;
              text-align:center;
              color:#6b7d9d;
            "
          >
            ✓ No active operational events.
            Network is currently clear.
          </td>
        </tr>
      `;

      return;
    }


    // Active events

    table.innerHTML = events.map(event => {

      const severity =
        String(event.severity || 'Medium').toLowerCase();


      return `
        <tr>

          <!-- LOCATION -->

          <td>
            <strong>
              ${event.location}
            </strong>
          </td>


          <!-- EVENT -->

          <td>

            <strong>
              ${event.type}
            </strong>

            ${
              event.description
                ? `
                  <div
                    style="
                      margin-top:5px;
                      font-size:12px;
                      color:#7183a2;
                    "
                  >
                    ${event.description}
                  </div>
                `
                : ''
            }

          </td>


          <!-- SEVERITY -->

          <td>
            <span class="tag ${severity}">
              ${event.severity}
            </span>
          </td>


          <!-- DURATION -->

          <td>
            ${event.duration} min
          </td>


          <!-- AFFECTED TRAINS -->

          <td>
            <strong>
              ${event.affected || 0}
            </strong>
            trains
          </td>


          <!-- STATUS -->

          <td>
            <span class="tag">
              ACTIVE
            </span>
          </td>


          <!-- ACTION -->

          <td>

            <button
              class="btn small secondary resolve-event"
              data-id="${event.id}"
            >
              Resolve
            </button>

          </td>

        </tr>
      `;

    }).join('');

  }


  // ==========================================================
  // OPEN ADD EVENT MODAL
  // ==========================================================

  if (addButton) {

    addButton.addEventListener('click', () => {

      UI.modal(
        'add-event',

        `
          <h2>
            Add operational event
          </h2>


          <form id="eventForm">

            <label class="field">

              Event Type

              <select id="eventType">

                <option value="Signal Failure">
                  Signal Failure
                </option>

                <option value="Heavy Congestion">
                  Heavy Congestion
                </option>

                <option value="Speed Restriction">
                  Speed Restriction
                </option>

                <option value="Heavy Rain">
                  Heavy Rain
                </option>

                <option value="Platform Congestion">
                  Platform Congestion
                </option>

                <option value="Track Obstruction">
                  Track Obstruction
                </option>

                <option value="Other Operational Issue">
                  Other Operational Issue
                </option>

              </select>

            </label>


            <label class="field">

              Location

              <select id="eventLocation">

                <option value="New Delhi">
                  New Delhi
                </option>

                <option value="Kanpur Central">
                  Kanpur Central
                </option>

                <option value="Prayagraj Jn">
                  Prayagraj Jn
                </option>

                <option value="DDU">
                  DDU
                </option>

                <option value="Gaya Jn">
                  Gaya Jn
                </option>

                <option value="Howrah">
                  Howrah
                </option>

                <option value="Dhanbad">
                  Dhanbad
                </option>

                <option value="Kota">
                  Kota
                </option>

                <option value="Vadodara">
                  Vadodara
                </option>

                <option value="Surat">
                  Surat
                </option>

                <option value="Mumbai Central">
                  Mumbai Central
                </option>

                <option value="Puri">
                  Puri
                </option>

                <option value="Bhubaneswar">
                  Bhubaneswar
                </option>

                <option value="Kharagpur">
                  Kharagpur
                </option>

                <option value="Tatanagar">
                  Tatanagar
                </option>

                <option value="KSR Bengaluru">
                  KSR Bengaluru
                </option>

                <option value="Guntakal">
                  Guntakal
                </option>

                <option value="Secunderabad">
                  Secunderabad
                </option>

                <option value="Bhopal">
                  Bhopal
                </option>

                <option value="Jhansi">
                  Jhansi
                </option>

                <option value="Patna Jn">
                  Patna Jn
                </option>

                <option value="New Jalpaiguri">
                  New Jalpaiguri
                </option>

                <option value="Guwahati">
                  Guwahati
                </option>

                <option value="Dibrugarh">
                  Dibrugarh
                </option>

                <option value="Jasidih">
                  Jasidih
                </option>

                <option value="Durgapur">
                  Durgapur
                </option>

                <option value="Sealdah">
                  Sealdah
                </option>

                <option value="Agra Cantt">
                  Agra Cantt
                </option>

                <option value="Gwalior">
                  Gwalior
                </option>

                <option value="Nagpur">
                  Nagpur
                </option>

                <option value="Bilaspur">
                  Bilaspur
                </option>

              </select>

            </label>


            <label class="field">

              Severity

              <select id="eventSeverity">

                <option value="Low">
                  Low
                </option>

                <option value="Medium" selected>
                  Medium
                </option>

                <option value="High">
                  High
                </option>

              </select>

            </label>


            <label class="field">

              Expected Duration

              <input
                id="eventDuration"
                type="number"
                min="1"
                value="30"
                required
              >

            </label>


            <label class="field">

              Description

              <textarea
                id="eventDescription"
                rows="3"
                placeholder="Optional operational detail"
              ></textarea>

            </label>


            <div class="actions">

              <button
                type="button"
                class="btn secondary"
                data-close
              >
                Cancel
              </button>

              <button
                type="submit"
                class="btn"
              >
                Submit Event
              </button>

            </div>

          </form>
        `
      );

    });

  }


  // ==========================================================
  // IMPORTANT:
  // HANDLE FORM SUBMIT USING EVENT DELEGATION
  // ==========================================================

  document.addEventListener('submit', event => {

    const form = event.target.closest('#eventForm');

    if (!form) return;

    event.preventDefault();


    // Get values

    const type =
      document.getElementById('eventType')?.value;

    const location =
      document.getElementById('eventLocation')?.value;

    const severity =
      document.getElementById('eventSeverity')?.value;

    const duration =
      Number(
        document.getElementById('eventDuration')?.value
      );

    const description =
      document.getElementById('eventDescription')?.value
        .trim();


    // Validate

    if (!type || !location || !severity) {

      UI.toast(
        'Please fill in all required fields'
      );

      return;
    }


    if (!duration || duration <= 0) {

      UI.toast(
        'Please enter a valid duration'
      );

      return;
    }


    // ========================================================
    // SEND EVENT TO MOCK SERVICE
    // ========================================================

    const newEvent = RailETA.addEvent({

      type: type,

      location: location,

      severity: severity,

      duration: duration,

      description: description

    });


    console.log(
      'EVENT SUBMITTED:',
      newEvent
    );


    // ========================================================
    // REFRESH TABLE
    // ========================================================

    renderEvents();


    // ========================================================
    // CLOSE MODAL
    // ========================================================

    const closeButton =
      document.querySelector(
        '[data-close]'
      );

    if (closeButton) {

      closeButton.click();

    }


    // ========================================================
    // SUCCESS MESSAGE
    // ========================================================

    UI.toast(
      `${type} added at ${location}`
    );

  });


  // ==========================================================
  // RESOLVE EVENT
  // ==========================================================

  document.addEventListener('click', event => {

    const button =
      event.target.closest(
        '.resolve-event'
      );


    if (!button) return;


    const id =
      button.dataset.id;


    RailETA.resolveEvent(id);


    renderEvents();


    UI.toast(
      'Operational event resolved'
    );

  });


  // ==========================================================
  // INITIAL RENDER
  // ==========================================================

  renderEvents();


  // ==========================================================
  // REFRESH WHEN DATA CHANGES
  // ==========================================================

  window.addEventListener(
    'railsync-update',
    renderEvents
  );

});