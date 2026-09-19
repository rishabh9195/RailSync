function trackSearch(form) {
    const input = form.querySelector("input").value.trim();

    if (!input) {
        showSearchMessage("Please enter a train number or train name");
        return false;
    }

    const trains = RailETA.getTrains();
    const needle = input.toLowerCase();

    const train = trains.find(t =>
        String(t.id).trim() === input.trim() ||
        String(t.name).toLowerCase().includes(needle)
    );

    if (!train) {
        showSearchMessage("Train not found. Try 12259, 12301, 12627, 12723, 12860 or 12951.");
        return false;
    }

    // Route is loaded automatically from mockData.js using the train id.
    location.href = "train.html?id=" + train.id;

    return false;
}

function showSearchMessage(msg) {
    if (typeof UI !== 'undefined' && typeof UI.toast === "function") {
        UI.toast(msg);
    } else {
        alert(msg);
    }
}
function paintResults() {
    document.getElementById("results").innerHTML =
        RailETA.getTrains()
            .map(
                (t, i) => `
                <article class="card result reveal">
                    <div>
                        <h3>🚆 ${t.id}${t.name ? ' ' + t.name : ''}</h3>
                        <p>
                            ${t.from} → ${t.to} ·
                            ${[
                        "15 Sep",
                        "16 Sep",
                        "17 Sep",
                        "18 Sep",
                        "19 Sep",
                        "20 Sep",
                        "21 Sep",
                        "22 Sep",
                        "23 Sep",
                        "24 Sep"
                    ][i % 10]} 2026 ·
                            Current location: ${t.location}
                        </p>
                    </div>

                    <div class="result-stats">
                        <div>
                            <small>DEPARTURE</small>
                            <b>${t.departure}</b>
                        </div>

                        <div>
                            <small>PREDICTED ARRIVAL</small>
                            <b>${t.eta}</b>
                        </div>

                        <div>
                            <small>CURRENT DELAY</small>
                            <b>+${t.delay} min</b>
                        </div>

                        <div>
                            ${UI.risk(t.risk)}
                        </div>
                    </div>

                    <div>
                        <a
                            class="btn small"
                            href="train.html?id=${t.id}"
                        >
                            View Live ETA
                        </a>
                    </div>
                </article>
                `
            )
            .join("");
}

document.addEventListener("DOMContentLoaded", paintResults);

window.addEventListener("railsync-update", paintResults);