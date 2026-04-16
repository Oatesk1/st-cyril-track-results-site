// Event classification
const RUNNING_EVENTS = new Set(["100M", "200M", "400M", "800M", "1600M"]);
const FIELD_EVENTS = new Set(["JV", "SP", "LJ"]);

const EVENT_LABELS = {
    "100M": "100 Meters",
    "200M": "200 Meters",
    "400M": "400 Meters",
    "800M": "800 Meters",
    "1600M": "1600 Meters",
    "JV": "Javelin",
    "SP": "Shot Put",
    "LJ": "Long Jump",
};

const EVENT_THEMES = {
    running: {
        line: "#1f5a43",
        fillTop: "rgba(31, 90, 67, 0.26)",
        fillBottom: "rgba(31, 90, 67, 0.02)",
        glow: "rgba(31, 90, 67, 0.20)",
        chip: "trend-chip--running",
    },
    field: {
        line: "#486652",
        fillTop: "rgba(72, 102, 82, 0.22)",
        fillBottom: "rgba(72, 102, 82, 0.02)",
        glow: "rgba(72, 102, 82, 0.18)",
        chip: "trend-chip--field",
    },
};

function parseTime(str) {
    if (!str) return null;
    const parts = str.split(":");
    if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(str);
}

function parseDistance(str) {
    if (!str) return null;
    if (str.includes("-")) {
        const parts = str.split("-");
        const feet = parseInt(parts[0], 10);
        const inches = parseFloat(parts[1]);
        return feet * 12 + inches;
    }
    return parseFloat(str) * 12;
}

function formatTime(seconds) {
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${mins}:${secs.padStart(5, "0")}`;
    }
    return seconds.toFixed(2);
}

function formatDistance(inches) {
    const feet = Math.floor(inches / 12);
    const remaining = (inches % 12).toFixed(2);
    return `${feet}-${remaining.padStart(5, "0")}`;
}

function parseMeetDate(str) {
    const parts = str.split("/");
    return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
}

function formatMeetDate(str) {
    const d = parseMeetDate(str);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function formatValue(value, isRunning) {
    return isRunning ? formatTime(value) : formatDistance(value);
}

function formatDelta(delta, isRunning) {
    const absolute = Math.abs(delta);
    if (isRunning) {
        return `${absolute.toFixed(2)}s`;
    }

    const feet = Math.floor(absolute / 12);
    const inches = absolute % 12;
    if (feet > 0) {
        return `${feet} ft ${inches.toFixed(2)} in`;
    }
    return `${inches.toFixed(2)} in`;
}

function getEventTheme(eventName) {
    return RUNNING_EVENTS.has(eventName) ? EVENT_THEMES.running : EVENT_THEMES.field;
}

function createInfoPill(text, className = "") {
    const pill = document.createElement("span");
    pill.className = `chart-pill ${className}`.trim();
    pill.textContent = text;
    return pill;
}

function collectEventHistory(athlete) {
    const history = {};
    const results = athlete.results || [];

    const sorted = [...results].sort(
        (a, b) => parseMeetDate(a.meet_date) - parseMeetDate(b.meet_date)
    );

    sorted.forEach((result) => {
        const events = result.events || {};
        Object.entries(events).forEach(([eventName, mark]) => {
            if (!history[eventName]) history[eventName] = [];
            const isRunning = RUNNING_EVENTS.has(eventName);
            const numericValue = isRunning ? parseTime(mark) : parseDistance(mark);
            if (numericValue !== null && !isNaN(numericValue)) {
                history[eventName].push({
                    date: result.meet_date,
                    label: formatMeetDate(result.meet_date),
                    rawValue: mark,
                    numericValue,
                    meetName: result.meet_name,
                });
            }
        });
    });

    return history;
}

const CHART_COLORS = {
    line: "#1f5a43",
    point: "#1f5a43",
    pointBorder: "#ffffff",
    grid: "rgba(109, 140, 121, 0.18)",
    text: "#587365",
    improvementGreen: "#226948",
    declineRed: "#6c4c2f",
};

function renderAthleteCharts(athlete, container) {
    const history = collectEventHistory(athlete);
    const chartableEvents = Object.entries(history).filter(([, entries]) => entries.length >= 2);

    if (chartableEvents.length === 0 || typeof Chart === "undefined") return;

    const chartsSection = document.createElement("div");
    chartsSection.className = "charts-section";

    const chartsHeading = document.createElement("p");
    chartsHeading.className = "charts-heading";
    chartsHeading.textContent = "Performance Trends";
    chartsSection.appendChild(chartsHeading);

    const chartsIntro = document.createElement("p");
    chartsIntro.className = "charts-intro";
    chartsIntro.textContent = "Hover the chart to inspect each meet and see how marks changed over time.";
    chartsSection.appendChild(chartsIntro);

    chartableEvents.forEach(([eventName, entries]) => {
        const isRunning = RUNNING_EVENTS.has(eventName);
        const theme = getEventTheme(eventName);
        const chartWrapper = document.createElement("div");
        chartWrapper.className = "chart-wrapper";

        const first = entries[0].numericValue;
        const last = entries[entries.length - 1].numericValue;
        const improved = isRunning ? last < first : last > first;
        const same = first === last;

        const chartHeader = document.createElement("div");
        chartHeader.className = "chart-header";

        const titleGroup = document.createElement("div");
        titleGroup.className = "chart-title-group";

        const chartTitle = document.createElement("div");
        chartTitle.className = "chart-title";
        chartTitle.textContent = EVENT_LABELS[eventName] || eventName;
        titleGroup.appendChild(chartTitle);

        const chartSubtitle = document.createElement("div");
        chartSubtitle.className = "chart-subtitle";
        chartSubtitle.textContent = `${entries.length} meets tracked`;
        titleGroup.appendChild(chartSubtitle);

        const chartMeta = document.createElement("div");
        chartMeta.className = "chart-meta";
        chartMeta.appendChild(createInfoPill(`Latest ${entries[entries.length - 1].rawValue}`, "chart-pill--neutral"));

        if (!same) {
            const directionLabel = improved
                ? (isRunning ? `Faster by ${formatDelta(last - first, true)}` : `Up ${formatDelta(last - first, false)}`)
                : (isRunning ? `Slower by ${formatDelta(last - first, true)}` : `Down ${formatDelta(last - first, false)}`);
            chartMeta.appendChild(createInfoPill(directionLabel, `trend-chip ${theme.chip} ${improved ? "trend-chip--up" : "trend-chip--down"}`));
        }

        chartHeader.appendChild(titleGroup);
        chartHeader.appendChild(chartMeta);
        chartWrapper.appendChild(chartHeader);

        const canvasShell = document.createElement("div");
        canvasShell.className = "chart-canvas-shell";

        const canvas = document.createElement("canvas");
        canvas.height = 220;
        canvasShell.appendChild(canvas);
        chartWrapper.appendChild(canvasShell);
        chartsSection.appendChild(chartWrapper);

        const values = entries.map((e) => e.numericValue);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal;
        const padding = range > 0 ? range * 0.3 : (Math.abs(minVal) * 0.05 || 1);
        const gradient = canvas.getContext("2d").createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, theme.fillTop);
        gradient.addColorStop(1, theme.fillBottom);

        new Chart(canvas, {
            type: "line",
            data: {
                labels: entries.map((e) => e.label),
                datasets: [
                    {
                        data: entries.map((e) => e.numericValue),
                        borderColor: theme.line,
                        backgroundColor: gradient,
                        pointBackgroundColor: theme.line,
                        pointBorderColor: CHART_COLORS.pointBorder,
                        pointBorderWidth: 2,
                        pointRadius: function (context) {
                            return context.dataIndex === entries.length - 1 ? 4 : 0;
                        },
                        pointHoverRadius: 6,
                        pointHitRadius: 18,
                        borderWidth: 3,
                        tension: 0.35,
                        cubicInterpolationMode: "monotone",
                        fill: true,
                        spanGaps: true,
                    },
                ],
            },
            options: {
                animation: {
                    duration: 900,
                    easing: "easeOutQuart",
                },
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false,
                },
                layout: {
                    padding: { top: 10, bottom: 4, left: 6, right: 8 },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            title: function (items) {
                                const idx = items[0].dataIndex;
                                return entries[idx].meetName;
                            },
                            label: function (item) {
                                return `Mark ${entries[item.dataIndex].rawValue}`;
                            },
                            afterLabel: function (item) {
                                const point = entries[item.dataIndex];
                                return `Date ${formatMeetDate(point.date)}`;
                            },
                        },
                        backgroundColor: "rgba(21, 52, 39, 0.94)",
                        titleFont: { size: 12, weight: "600" },
                        bodyFont: { size: 13, weight: "700" },
                        footerFont: { size: 11 },
                        padding: 12,
                        cornerRadius: 12,
                        caretPadding: 10,
                    },
                },
                scales: {
                    x: {
                        border: {
                            display: false,
                        },
                        grid: {
                            display: false,
                            drawTicks: false,
                        },
                        ticks: {
                            color: CHART_COLORS.text,
                            font: { size: 11, weight: "600" },
                            maxRotation: 0,
                        },
                    },
                    y: {
                        reverse: false,
                        min: minVal - padding,
                        max: maxVal + padding,
                        border: {
                            display: false,
                        },
                        grid: {
                            color: CHART_COLORS.grid,
                            borderDash: [4, 5],
                            drawTicks: false,
                        },
                        ticks: {
                            color: CHART_COLORS.text,
                            font: { size: 11 },
                            count: 4,
                            padding: 10,
                            callback: function (value) {
                                return isRunning ? formatTime(value) : formatDistance(value);
                            },
                        },
                    },
                },
            },
        });
    });

    container.appendChild(chartsSection);
}