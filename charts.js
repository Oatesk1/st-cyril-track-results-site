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

// Parse a time string like "19.03" or "1:34.99" or "2:29.11" into total seconds
function parseTime(str) {
    if (!str) return null;
    const parts = str.split(":");
    if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(str);
}

// Parse a distance string like "20-03", "5-08.00", "33-01.00" into total inches
function parseDistance(str) {
    if (!str) return null;
    if (str.includes("-")) {
        const parts = str.split("-");
        const feet = parseInt(parts[0], 10);
        const inches = parseFloat(parts[1]);
        return feet * 12 + inches;
    }
    // No dash - treat as decimal feet
    return parseFloat(str) * 12;
}

// Convert numeric value to a display label
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

// Parse a date string like "3/28/2026" into a Date
function parseMeetDate(str) {
    const parts = str.split("/");
    return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

// Format date for display
function formatMeetDate(str) {
    const d = parseMeetDate(str);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

// Collect event history for an athlete: { eventName: [{date, rawValue, numericValue}, ...] }
function collectEventHistory(athlete) {
    const history = {};
    const results = athlete.results || [];

    // Sort results by date (chronological)
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
                    numericValue: numericValue,
                    meetName: result.meet_name,
                });
            }
        });
    });

    return history;
}

// Color palette for charts
const CHART_COLORS = {
    line: "#0b6cf0",
    point: "#0b6cf0",
    pointBorder: "#ffffff",
    grid: "#e5e7eb",
    text: "#4b5563",
    improvementGreen: "#16a34a",
    declineRed: "#dc2626",
};

// Build charts for a given athlete and append to the container element
function renderAthleteCharts(athlete, container) {
    const history = collectEventHistory(athlete);

    // Only chart events with 2+ data points
    const chartableEvents = Object.entries(history).filter(
        ([, entries]) => entries.length >= 2
    );

    if (chartableEvents.length === 0) return;

    const chartsSection = document.createElement("div");
    chartsSection.className = "charts-section";

    const chartsHeading = document.createElement("p");
    chartsHeading.className = "charts-heading";
    chartsHeading.textContent = "Performance Trends";
    chartsSection.appendChild(chartsHeading);

    chartableEvents.forEach(([eventName, entries]) => {
        const isRunning = RUNNING_EVENTS.has(eventName);
        const chartWrapper = document.createElement("div");
        chartWrapper.className = "chart-wrapper";

        const chartTitle = document.createElement("div");
        chartTitle.className = "chart-title";
        chartTitle.textContent = EVENT_LABELS[eventName] || eventName;

        // Add improvement indicator
        const first = entries[0].numericValue;
        const last = entries[entries.length - 1].numericValue;
        const improved = isRunning ? last < first : last > first;
        const same = first === last;
        if (!same) {
            const arrow = document.createElement("span");
            arrow.className = improved ? "trend-improved" : "trend-declined";
            arrow.textContent = improved ? " \u2193 Improved" : " \u2191 Declined";
            if (isRunning && !improved) {
                arrow.textContent = " \u2191 Slower";
            } else if (isRunning && improved) {
                arrow.textContent = " \u2193 Faster";
            }
            chartTitle.appendChild(arrow);
        }

        chartWrapper.appendChild(chartTitle);

        const canvas = document.createElement("canvas");
        canvas.height = 200;
        chartWrapper.appendChild(canvas);

        chartsSection.appendChild(chartWrapper);

        // Compute Y-axis range with padding so small differences are visible
        const values = entries.map((e) => e.numericValue);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal;
        const padding = range > 0 ? range * 0.25 : (minVal * 0.05 || 1);

        new Chart(canvas, {
            type: "line",
            data: {
                labels: entries.map((e) => e.label),
                datasets: [
                    {
                        data: entries.map((e) => e.numericValue),
                        borderColor: CHART_COLORS.line,
                        backgroundColor: CHART_COLORS.line + "22",
                        pointBackgroundColor: CHART_COLORS.point,
                        pointBorderColor: CHART_COLORS.pointBorder,
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        borderWidth: 2.5,
                        tension: 0.15,
                        fill: true,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 8, bottom: 4, left: 4, right: 4 },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function (items) {
                                const idx = items[0].dataIndex;
                                return entries[idx].meetName;
                            },
                            label: function (item) {
                                return entries[item.dataIndex].rawValue;
                            },
                        },
                        backgroundColor: "#1f2937",
                        titleFont: { size: 11 },
                        bodyFont: { size: 13, weight: "bold" },
                        padding: 10,
                        cornerRadius: 6,
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: CHART_COLORS.text,
                            font: { size: 11 },
                        },
                    },
                    y: {
                        reverse: false,
                        min: minVal - padding,
                        max: maxVal + padding,
                        grid: {
                            color: CHART_COLORS.grid,
                        },
                        ticks: {
                            color: CHART_COLORS.text,
                            font: { size: 11 },
                            callback: function (value) {
                                if (isRunning) {
                                    return formatTime(value);
                                } else {
                                    return formatDistance(value);
                                }
                            },
                        },
                    },
                },
            },
        });
    });

    container.appendChild(chartsSection);
}
