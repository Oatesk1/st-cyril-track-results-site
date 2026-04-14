const searchInput = document.getElementById("nameSearch");
const resultsEl = document.getElementById("results");
const statusTextEl = document.getElementById("statusText");
let athletes = [];
let activeCharts = [];

const FIELD_EVENTS = new Set(["JV", "SP", "LJ", "DT", "HJ"]);

function parseTimeMark(mark) {
    if (mark.includes(":")) {
        const [min, sec] = mark.split(":");
        return parseFloat(min) * 60 + parseFloat(sec);
    }
    return parseFloat(mark);
}

function parseDistanceMark(mark) {
    const cleaned = mark.replace(/\s/g, "");
    const match = cleaned.match(/^(\d+)-(\d+(?:\.\d+)?)$/);
    if (match) {
        return parseInt(match[1]) + parseFloat(match[2]) / 12;
    }
    return parseFloat(cleaned);
}

function parseMark(eventName, mark) {
    return FIELD_EVENTS.has(eventName) ? parseDistanceMark(mark) : parseTimeMark(mark);
}

function formatAxisLabel(eventName, val) {
    if (FIELD_EVENTS.has(eventName)) {
        const feet = Math.floor(val);
        const inches = Math.round((val - feet) * 12 * 100) / 100;
        return `${feet}' ${inches.toFixed(1)}"`;
    }
    if (val >= 60) {
        const min = Math.floor(val / 60);
        const sec = (val - min * 60).toFixed(2);
        return `${min}:${sec.padStart(5, "0")}`;
    }
    return val.toFixed(2);
}

function parseMeetDate(dateStr) {
    const parts = dateStr.split("/");
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

function buildEventSeries(athlete) {
    const eventMap = {};
    const sortedResults = [...(athlete.results || [])].sort(
        (a, b) => parseMeetDate(a.meet_date) - parseMeetDate(b.meet_date)
    );

    sortedResults.forEach((result) => {
        Object.entries(result.events || {}).forEach(([eventName, mark]) => {
            if (!eventMap[eventName]) eventMap[eventName] = [];
            eventMap[eventName].push({
                date: result.meet_date,
                label: result.meet_name.length > 30
                    ? result.meet_name.substring(0, 28) + "…"
                    : result.meet_name,
                raw: mark,
                value: parseMark(eventName, mark),
            });
        });
    });

    // Only return events with 2+ data points
    return Object.fromEntries(
        Object.entries(eventMap).filter(([, pts]) => pts.length >= 2)
    );
}

function destroyActiveCharts() {
    activeCharts.forEach((c) => c.destroy());
    activeCharts = [];
}

function renderChart(container, eventName, dataPoints) {
    const isField = FIELD_EVENTS.has(eventName);
    const values = dataPoints.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = range * 0.25;

    // For running events lower is better, for field events higher is better
    let yMin, yMax;
    if (isField) {
        yMin = Math.max(0, min - padding);
        yMax = max + padding;
    } else {
        yMin = Math.max(0, min - padding);
        yMax = max + padding;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";

    const heading = document.createElement("h4");
    heading.className = "chart-heading";
    heading.textContent = eventName + (isField ? " (distance)" : " (time)");
    wrapper.appendChild(heading);

    const canvas = document.createElement("canvas");
    canvas.height = 200;
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: dataPoints.map((d) => d.date),
            datasets: [{
                label: eventName,
                data: values,
                borderColor: "#0b6cf0",
                backgroundColor: "rgba(11, 108, 240, 0.1)",
                borderWidth: 2,
                pointRadius: 5,
                pointBackgroundColor: "#0b6cf0",
                pointHoverRadius: 7,
                fill: true,
                tension: 0.2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 4, bottom: 4 } },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    reverse: false,
                    ticks: {
                        callback: (val) => formatAxisLabel(eventName, val),
                        font: { size: 11 },
                    },
                    title: {
                        display: true,
                        text: isField ? "Distance" : "Time",
                        font: { size: 12 },
                    },
                },
                x: {
                    ticks: { font: { size: 11 } },
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (items) => dataPoints[items[0].dataIndex].label,
                        label: (item) => dataPoints[item.dataIndex].raw,
                    },
                },
                legend: { display: false },
            },
        },
    });

    activeCharts.push(chart);
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
    destroyActiveCharts();
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

        // Render line charts for events with 2+ data points
        const eventSeries = buildEventSeries(athlete);
        const eventNames = Object.keys(eventSeries);
        if (eventNames.length > 0) {
            const chartsSection = document.createElement("div");
            chartsSection.className = "charts-section";

            const chartsLabel = document.createElement("p");
            chartsLabel.className = "charts-label";
            chartsLabel.textContent = "Performance Over Time";
            chartsSection.appendChild(chartsLabel);

            eventNames.forEach((eventName) => {
                renderChart(chartsSection, eventName, eventSeries[eventName]);
            });

            card.appendChild(chartsSection);
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
