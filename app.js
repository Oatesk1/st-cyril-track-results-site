const searchInput = document.getElementById("nameSearch");
const resultsEl = document.getElementById("results");
const statusTextEl = document.getElementById("statusText");
let athletes = [];
let activeCharts = [];

const EVENT_COLORS = {
    "100M": "#e63946",
    "200M": "#f77f00",
    "400M": "#fcbf49",
    "800M": "#2a9d8f",
    "1600M": "#264653",
    "JV": "#7209b7",
    "SP": "#3a86a7",
    "LJ": "#06d6a0"
};

function parseTimeToSeconds(mark) {
    if (mark.includes(":")) {
        const parts = mark.split(":");
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(mark);
}

function parseDistanceToInches(mark) {
    const cleaned = mark.replace(/\.00$/, "");
    if (cleaned.includes("-")) {
        const parts = cleaned.split("-");
        return parseFloat(parts[0]) * 12 + parseFloat(parts[1]);
    }
    return parseFloat(cleaned);
}

function isTimeEvent(eventName) {
    return ["100M", "200M", "400M", "800M", "1600M"].includes(eventName);
}

function parseMeetDate(dateStr) {
    const parts = dateStr.split("/");
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

function formatShortDate(dateStr) {
    const d = parseMeetDate(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function renderProgressionChart(athlete, container) {
    const results = (athlete.results || []).slice().sort(
        (a, b) => parseMeetDate(a.meet_date) - parseMeetDate(b.meet_date)
    );
    if (results.length < 2) return;

    const allEvents = new Set();
    results.forEach(r => Object.keys(r.events || {}).forEach(e => allEvents.add(e)));

    const timeEvents = [...allEvents].filter(isTimeEvent);
    const fieldEvents = [...allEvents].filter(e => !isTimeEvent(e));

    function buildChart(eventList, label, parseFunc, lowerIsBetter) {
        const relevantResults = results.filter(r =>
            eventList.some(e => r.events && r.events[e] !== undefined)
        );
        if (relevantResults.length < 2) return;

        const chartWrap = document.createElement("div");
        chartWrap.className = "chart-wrap";

        const chartTitle = document.createElement("p");
        chartTitle.className = "chart-title";
        chartTitle.textContent = label;
        chartWrap.appendChild(chartTitle);

        const canvas = document.createElement("canvas");
        canvas.height = 200;
        chartWrap.appendChild(canvas);
        container.appendChild(chartWrap);

        const labels = relevantResults.map(r => formatShortDate(r.meet_date));
        const datasets = eventList
            .filter(event => relevantResults.some(r => r.events && r.events[event] !== undefined))
            .map(event => ({
                label: event,
                data: relevantResults.map(r => (r.events && r.events[event] !== undefined) ? parseFunc(r.events[event]) : null),
                borderColor: EVENT_COLORS[event] || "#888",
                backgroundColor: (EVENT_COLORS[event] || "#888") + "22",
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.3,
                spanGaps: true,
                fill: false
            }));

        const chart = new Chart(canvas, {
            type: "line",
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { position: "bottom", labels: { boxWidth: 12, padding: 10 } },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const raw = relevantResults[ctx.dataIndex]?.events?.[ctx.dataset.label];
                                return raw ? `${ctx.dataset.label}: ${raw}` : "";
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        reverse: lowerIsBetter,
                        title: { display: true, text: lowerIsBetter ? "Time (seconds)" : "Distance (inches)" },
                        grid: { color: "#eee" }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
        activeCharts.push(chart);
    }

    if (timeEvents.length > 0) buildChart(timeEvents, "Sprint & Distance Progression", parseTimeToSeconds, true);
    if (fieldEvents.length > 0) buildChart(fieldEvents, "Field Event Progression", parseDistanceToInches, false);
}

function renderEventList(events, isPrFromLatestMeet = []) {
    const list = document.createElement("ul");
    list.className = "record-list";

    Object.entries(events).forEach(([eventName, mark]) => {
        const item = document.createElement("li");
        const isFromLatestMeet = isPrFromLatestMeet.includes(eventName);
        const asterisk = isFromLatestMeet ? '*' : '';
        item.textContent = `${eventName} - ${mark}${asterisk}`;
        list.appendChild(item);
    });

    return list;
}

function renderResults(matches, query) {
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
    resultsEl.innerHTML = "";

    if (!query) {
        statusTextEl.textContent = "Start typing to search.";
        return;
    }

    if (matches.length === 0) {
        statusTextEl.textContent = "No athlete found for that name.";
        return;
    }

    statusTextEl.textContent = `Found ${matches.length} athlete${matches.length > 1 ? "s" : ""}.`;

    let hasAsterisk = false;

    matches.forEach((athlete) => {
        const card = document.createElement("article");
        card.className = "result-card";

        const title = document.createElement("h3");
        title.textContent = athlete.name;
        card.appendChild(title);

        const personalRecords = athlete.personal_records || {};
        const personalRecordKeys = Object.keys(personalRecords);

        if (personalRecordKeys.length > 0) {
            const prLabel = document.createElement("p");
            prLabel.textContent = "Personal Records";
            card.appendChild(prLabel);
            const prFromLatestMeet = athlete.pr_from_latest_meet || [];
            if (prFromLatestMeet.length > 0) {
                hasAsterisk = true;
            }
            card.appendChild(renderEventList(personalRecords, prFromLatestMeet));
        }

        const latestResult = (athlete.results || []).find((result) => result.is_latest_meet) || (athlete.results || [])[0];

        if (latestResult && latestResult.events) {
            const latestLabel = document.createElement("p");
            latestLabel.textContent = `Latest Meet: ${latestResult.meet_name} (${latestResult.meet_date})`;
            card.appendChild(latestLabel);
            card.appendChild(renderEventList(latestResult.events));
        }

        const chartSection = document.createElement("div");
        chartSection.className = "chart-section";
        renderProgressionChart(athlete, chartSection);
        if (chartSection.children.length > 0) {
            const chartHeader = document.createElement("p");
            chartHeader.className = "chart-header";
            chartHeader.textContent = "Performance Progression";
            card.appendChild(chartHeader);
            card.appendChild(chartSection);
        }

        resultsEl.appendChild(card);
    });

    // Add footnote if there are asterisks
    if (hasAsterisk) {
        const footnote = document.createElement("div");
        footnote.className = "footnote";
        footnote.innerHTML = '<p><small>* PR from Most Recent Competition</small></p>';
        resultsEl.appendChild(footnote);
    }
}

searchInput.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const matches = athletes.filter((athlete) => {
        const name = (athlete.name || "").toLowerCase();
        const searchName = (athlete.search_name || "").toLowerCase();
        return name.includes(query) || searchName.includes(query);
    });

    renderResults(matches, query);
});

async function loadAthletes() {
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`./athlete_records.json?ts=${cacheBuster}`, {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("Could not load athlete_records.json");
        }

        const data = await response.json();
        athletes = Array.isArray(data.athletes) ? data.athletes : [];
        statusTextEl.textContent = "Start typing to search.";
    } catch (error) {
        statusTextEl.textContent = "Could not load athlete data. Check athlete_records.json and run with a local server.";
    }
}

loadAthletes();
