let athletes = [];
let allCharts = [];
let currentView = "pr-comparison";

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

const TIME_EVENTS = ["100M", "200M", "400M", "800M", "1600M"];
const FIELD_EVENTS = ["JV", "SP", "LJ"];

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

function isTimeEvent(e) {
    return TIME_EVENTS.includes(e);
}

function parseMeetDate(dateStr) {
    const parts = dateStr.split("/");
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

function destroyCharts() {
    allCharts.forEach(c => c.destroy());
    allCharts = [];
}

function renderSummary() {
    const el = document.getElementById("teamSummary");
    const totalAthletes = athletes.length;
    const allEvents = new Set();
    let totalMeets = new Set();
    let totalPRs = 0;

    athletes.forEach(a => {
        Object.keys(a.personal_records || {}).forEach(e => allEvents.add(e));
        (a.results || []).forEach(r => totalMeets.add(r.meet_name));
        totalPRs += (a.pr_from_latest_meet || []).length;
    });

    const stats = [
        { value: totalAthletes, label: "Athletes" },
        { value: allEvents.size, label: "Events" },
        { value: totalMeets.size, label: "Meets Tracked" },
        { value: totalPRs, label: "Latest Meet PRs" }
    ];

    el.innerHTML = stats.map(s => `
        <div class="summary-stat">
            <div class="stat-value">${s.value}</div>
            <div class="stat-label">${s.label}</div>
        </div>
    `).join("");
}

function renderTabs() {
    const tabs = document.getElementById("chartTabs");
    const views = [
        { id: "pr-comparison", label: "PR Comparison" },
        { id: "event-participation", label: "Event Participation" },
        { id: "improvement", label: "Most Improved" }
    ];

    tabs.innerHTML = views.map(v =>
        `<button class="chart-tab${v.id === currentView ? " active" : ""}" data-view="${v.id}">${v.label}</button>`
    ).join("");

    tabs.querySelectorAll(".chart-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            currentView = btn.dataset.view;
            renderTabs();
            renderView();
        });
    });
}

function renderView() {
    destroyCharts();
    const container = document.getElementById("chartContent");
    container.innerHTML = "";

    if (currentView === "pr-comparison") renderPRComparison(container);
    else if (currentView === "event-participation") renderParticipation(container);
    else if (currentView === "improvement") renderImprovement(container);
}

function getShortName(name) {
    const parts = name.split(", ");
    return parts.length > 1 ? `${parts[1]} ${parts[0].charAt(0)}.` : name;
}

function renderPRComparison(container) {
    const allEvents = new Set();
    athletes.forEach(a => Object.keys(a.personal_records || {}).forEach(e => allEvents.add(e)));

    const eventList = [...allEvents].sort((a, b) => {
        const order = ["100M", "200M", "400M", "800M", "1600M", "LJ", "SP", "JV"];
        return order.indexOf(a) - order.indexOf(b);
    });

    eventList.forEach(event => {
        const eventAthletes = athletes
            .filter(a => a.personal_records && a.personal_records[event])
            .map(a => ({
                name: getShortName(a.name),
                mark: a.personal_records[event],
                value: isTimeEvent(event) ? parseTimeToSeconds(a.personal_records[event]) : parseDistanceToInches(a.personal_records[event])
            }))
            .sort((a, b) => isTimeEvent(event) ? a.value - b.value : b.value - a.value);

        if (eventAthletes.length === 0) return;

        const section = document.createElement("div");
        section.className = "event-section";

        const title = document.createElement("h3");
        title.textContent = event + (isTimeEvent(event) ? " (lower is better)" : " (higher is better)");
        section.appendChild(title);

        const chartWrap = document.createElement("div");
        chartWrap.className = "event-chart-wrap";
        const canvas = document.createElement("canvas");
        chartWrap.appendChild(canvas);
        section.appendChild(chartWrap);
        container.appendChild(section);

        const color = EVENT_COLORS[event] || "#888";
        const chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: eventAthletes.map(a => a.name),
                datasets: [{
                    label: event + " PR",
                    data: eventAthletes.map(a => a.value),
                    backgroundColor: color + "cc",
                    borderColor: color,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return eventAthletes[ctx.dataIndex].mark;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: isTimeEvent(event) ? "Time (seconds)" : "Distance (inches)"
                        },
                        grid: { color: "#eee" }
                    },
                    y: { grid: { display: false } }
                }
            }
        });
        allCharts.push(chart);
    });
}

function renderParticipation(container) {
    const eventCounts = {};
    athletes.forEach(a => {
        Object.keys(a.personal_records || {}).forEach(e => {
            eventCounts[e] = (eventCounts[e] || 0) + 1;
        });
    });

    const section = document.createElement("div");
    section.className = "event-section";
    section.innerHTML = "<h3>Athletes per Event</h3>";
    const chartWrap = document.createElement("div");
    chartWrap.className = "event-chart-wrap";
    const canvas = document.createElement("canvas");
    chartWrap.appendChild(canvas);
    section.appendChild(chartWrap);
    container.appendChild(section);

    const sortedEvents = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]);
    const chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: sortedEvents.map(([e]) => e),
            datasets: [{
                label: "Athletes",
                data: sortedEvents.map(([, c]) => c),
                backgroundColor: sortedEvents.map(([e]) => (EVENT_COLORS[e] || "#888") + "cc"),
                borderColor: sortedEvents.map(([e]) => EVENT_COLORS[e] || "#888"),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: "Number of Athletes" },
                    grid: { color: "#eee" }
                },
                x: { grid: { display: false } }
            }
        }
    });
    allCharts.push(chart);

    // Meets per athlete chart
    const meetSection = document.createElement("div");
    meetSection.className = "event-section";
    meetSection.innerHTML = "<h3>Meets per Athlete</h3>";
    const meetChartWrap = document.createElement("div");
    meetChartWrap.className = "event-chart-wrap";
    const meetCanvas = document.createElement("canvas");
    meetChartWrap.appendChild(meetCanvas);
    meetSection.appendChild(meetChartWrap);
    container.appendChild(meetSection);

    const meetData = athletes
        .map(a => ({ name: getShortName(a.name), meets: (a.results || []).length }))
        .sort((a, b) => b.meets - a.meets);

    const meetChart = new Chart(meetCanvas, {
        type: "bar",
        data: {
            labels: meetData.map(d => d.name),
            datasets: [{
                label: "Meets",
                data: meetData.map(d => d.meets),
                backgroundColor: "#0b6cf0cc",
                borderColor: "#0b6cf0",
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: "Number of Meets" },
                    grid: { color: "#eee" }
                },
                x: { grid: { display: false } }
            }
        }
    });
    allCharts.push(meetChart);
}

function renderImprovement(container) {
    const improvements = [];

    athletes.forEach(athlete => {
        const results = (athlete.results || []).slice().sort(
            (a, b) => parseMeetDate(a.meet_date) - parseMeetDate(b.meet_date)
        );
        if (results.length < 2) return;

        const allEvents = new Set();
        results.forEach(r => Object.keys(r.events || {}).forEach(e => allEvents.add(e)));

        allEvents.forEach(event => {
            const marks = results
                .filter(r => r.events && r.events[event] !== undefined)
                .map(r => ({
                    value: isTimeEvent(event) ? parseTimeToSeconds(r.events[event]) : parseDistanceToInches(r.events[event]),
                    raw: r.events[event],
                    date: r.meet_date
                }));

            if (marks.length < 2) return;

            const first = marks[0];
            const last = marks[marks.length - 1];

            let pctImprovement;
            if (isTimeEvent(event)) {
                pctImprovement = ((first.value - last.value) / first.value) * 100;
            } else {
                pctImprovement = ((last.value - first.value) / first.value) * 100;
            }

            if (pctImprovement > 0) {
                improvements.push({
                    name: getShortName(athlete.name),
                    event,
                    pct: pctImprovement,
                    from: first.raw,
                    to: last.raw
                });
            }
        });
    });

    improvements.sort((a, b) => b.pct - a.pct);
    const top = improvements.slice(0, 15);

    if (top.length === 0) {
        container.innerHTML = '<div class="event-section"><p>Not enough historical data to calculate improvements.</p></div>';
        return;
    }

    const section = document.createElement("div");
    section.className = "event-section";
    section.innerHTML = "<h3>Top Improvements (first meet to latest)</h3>";
    const chartWrap = document.createElement("div");
    chartWrap.className = "event-chart-wrap";
    chartWrap.style.height = Math.max(300, top.length * 32) + "px";
    const canvas = document.createElement("canvas");
    chartWrap.appendChild(canvas);
    section.appendChild(chartWrap);
    container.appendChild(section);

    const chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: top.map(d => `${d.name} (${d.event})`),
            datasets: [{
                label: "Improvement %",
                data: top.map(d => Math.round(d.pct * 10) / 10),
                backgroundColor: top.map(d => (EVENT_COLORS[d.event] || "#888") + "cc"),
                borderColor: top.map(d => EVENT_COLORS[d.event] || "#888"),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const d = top[ctx.dataIndex];
                            return `${d.pct.toFixed(1)}% improvement: ${d.from} -> ${d.to}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Improvement %" },
                    grid: { color: "#eee" }
                },
                y: { grid: { display: false } }
            }
        }
    });
    allCharts.push(chart);
}

async function init() {
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`./athlete_records.json?ts=${cacheBuster}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load athlete_records.json");
        const data = await response.json();
        athletes = Array.isArray(data.athletes) ? data.athletes : [];

        renderSummary();
        renderTabs();
        renderView();
    } catch (error) {
        document.getElementById("chartContent").innerHTML =
            '<div class="event-section"><p>Could not load athlete data.</p></div>';
    }
}

init();
