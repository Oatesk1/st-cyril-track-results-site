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

const TARGET_LINE_STYLES = {
    prelim_qualifying: {
        label: "2025 CYO Prelim Qual.",
        color: "#597796",
        dash: [6, 4],
        pillClass: "chart-pill--prelim",
    },
    finals_qualifying: {
        label: "2025 CYO Finals Qual.",
        color: "#b47b17",
        dash: [10, 5],
        pillClass: "chart-pill--finals",
    },
    winner: {
        label: "2025 CYO Winner",
        color: "#b54d3e",
        dash: [2, 4],
        pillClass: "chart-pill--winner",
    },
    custom_goal: {
        label: "Custom Goal",
        color: "#c27a1a",
        dash: [8, 6],
        pillClass: "chart-pill--goal",
    },
};

function parseTime(str) {
    if (!str) return null;
    const parts = str.split(":");
    if (parts.length > 1) {
        return parts.reduce((total, part) => total * 60 + parseFloat(part), 0);
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

function compareToTarget(value, targetValue, isRunning) {
    if (!Number.isFinite(value) || !Number.isFinite(targetValue)) {
        return "neutral";
    }

    if (value === targetValue) {
        return "neutral";
    }

    const isBetter = isRunning ? value < targetValue : value > targetValue;
    return isBetter ? "positive" : "negative";
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

function createDetailRow(label, value, options = {}) {
    const row = document.createElement(options.clickable ? "button" : "div");
    row.className = "chart-detail-row";

    if (options.clickable) {
        row.type = "button";
        row.classList.add("chart-detail-row--interactive");
    }

    if (options.active) {
        row.classList.add("chart-detail-row--active");
    }

    const labelEl = document.createElement("span");
    labelEl.className = "chart-detail-label";
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.className = `chart-detail-value ${options.valueClassName || ""}`.trim();
    valueEl.textContent = value;
    row.appendChild(valueEl);

    if (options.metaText) {
        const metaEl = document.createElement("span");
        metaEl.className = `chart-detail-meta ${options.metaClassName || ""}`.trim();
        metaEl.textContent = options.metaText;
        row.appendChild(metaEl);
    }

    return row;
}

function getGoalNumericValue(eventName, goalMark) {
    if (!goalMark) {
        return null;
    }

    const isRunning = RUNNING_EVENTS.has(eventName);
    const numericValue = isRunning ? parseTime(goalMark) : parseDistance(goalMark);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function buildChartTargets(eventName, chartConfig = {}) {
    const targets = [];
    const divisionEventTargets = chartConfig.divisionGroup?.events?.[eventName];

    if (divisionEventTargets && typeof divisionEventTargets === "object") {
        ["prelim_qualifying", "finals_qualifying", "winner"].forEach((key) => {
            const mark = divisionEventTargets[key];
            const numericValue = getGoalNumericValue(eventName, mark);
            if (!mark || numericValue === null) {
                return;
            }

            targets.push({
                key,
                mark,
                numericValue,
                ...TARGET_LINE_STYLES[key],
            });
        });
    }

    if (targets.length === 0) {
        const customGoalMark = chartConfig.customGoals?.[eventName];
        const numericValue = getGoalNumericValue(eventName, customGoalMark);
        if (customGoalMark && numericValue !== null) {
            targets.push({
                key: "custom_goal",
                mark: customGoalMark,
                numericValue,
                ...TARGET_LINE_STYLES.custom_goal,
            });
        }
    }

    return targets;
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

function renderAthleteCharts(athlete, container, chartConfig = {}) {
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
        const targets = buildChartTargets(eventName, chartConfig);
        const chartWrapper = document.createElement("div");
        chartWrapper.className = "chart-wrapper";

        const last = entries[entries.length - 1].numericValue;
        const previous = entries[entries.length - 2].numericValue;
        const best = isRunning ? Math.min(...entries.map((entry) => entry.numericValue)) : Math.max(...entries.map((entry) => entry.numericValue));
        const improved = isRunning ? last < previous : last > previous;
        const same = previous === last;

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
        chartSubtitle.textContent = `${entries.length} meets tracked • vs prior meet`;
        titleGroup.appendChild(chartSubtitle);

        const chartMeta = document.createElement("div");
        chartMeta.className = "chart-meta";
        chartMeta.appendChild(createInfoPill(`Latest ${entries[entries.length - 1].rawValue}`, "chart-pill--neutral"));

        if (!same) {
            const directionLabel = improved
                ? (isRunning ? `Faster by ${formatDelta(last - previous, true)}` : `Up ${formatDelta(last - previous, false)}`)
                : (isRunning ? `Slower by ${formatDelta(last - previous, true)}` : `Down ${formatDelta(last - previous, false)}`);
            const trendNote = document.createElement("div");
            trendNote.className = `chart-trend-note ${improved ? "chart-trend-note--up" : "chart-trend-note--down"}`;
            trendNote.textContent = directionLabel;
            titleGroup.appendChild(trendNote);
        }

        chartHeader.appendChild(titleGroup);
        chartHeader.appendChild(chartMeta);
        chartWrapper.appendChild(chartHeader);

        const chartBody = document.createElement("div");
        chartBody.className = "chart-body";

        const canvasShell = document.createElement("div");
        canvasShell.className = "chart-canvas-shell";

        const canvas = document.createElement("canvas");
        canvas.height = 220;
        canvasShell.appendChild(canvas);
        chartBody.appendChild(canvasShell);

        const chartDetails = chartConfig.divisionGroup?.label
            ? document.createElement("aside")
            : null;
        const targetRows = new Map();

        if (chartDetails) {
            chartDetails.className = "chart-details";
            chartDetails.appendChild(createDetailRow("Division", chartConfig.divisionGroup.label));
            chartBody.appendChild(chartDetails);
        }

        chartWrapper.appendChild(chartBody);
        chartsSection.appendChild(chartWrapper);

        const values = entries.map((e) => e.numericValue);
        const getPadding = (localMin, localMax) => {
            const localRange = localMax - localMin;
            return localRange > 0 ? localRange * 0.3 : (Math.abs(localMin) * 0.05 || 1);
        };
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const padding = getPadding(minVal, maxVal);
        const gradient = canvas.getContext("2d").createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, theme.fillTop);
        gradient.addColorStop(1, theme.fillBottom);

        const chart = new Chart(canvas, {
            type: "line",
            data: {
                labels: entries.map((e) => e.label),
                datasets: [
                    {
                        label: "Performance",
                        data: values,
                        borderColor: theme.line,
                        backgroundColor: gradient,
                        pointBackgroundColor: function (context) {
                            const activeTargetValue = context.chart.data.datasets[0].activeTargetValue;
                            if (!Number.isFinite(activeTargetValue)) {
                                return theme.line;
                            }

                            const pointValue = context.raw;
                            const comparison = compareToTarget(pointValue, activeTargetValue, isRunning);
                            if (comparison === "positive") {
                                return CHART_COLORS.improvementGreen;
                            }
                            if (comparison === "negative") {
                                return CHART_COLORS.declineRed;
                            }
                            return theme.line;
                        },
                        pointBorderColor: CHART_COLORS.pointBorder,
                        pointBorderWidth: 2,
                        pointRadius: function (context) {
                            const activeTargetValue = context.chart.data.datasets[0].activeTargetValue;
                            if (Number.isFinite(activeTargetValue)) {
                                return context.dataIndex === entries.length - 1 ? 4 : 3;
                            }
                            return context.dataIndex === entries.length - 1 ? 4 : 0;
                        },
                        pointHoverRadius: 6,
                        pointHitRadius: 18,
                        borderWidth: 3,
                        tension: 0.35,
                        cubicInterpolationMode: "monotone",
                        fill: true,
                        spanGaps: true,
                        activeTargetValue: null,
                        segment: {
                            borderColor: function (context) {
                                const activeTargetValue = context.chart.data.datasets[0].activeTargetValue;
                                if (!Number.isFinite(activeTargetValue)) {
                                    return theme.line;
                                }

                                const comparison = compareToTarget(context.p1.parsed.y, activeTargetValue, isRunning);
                                if (comparison === "positive") {
                                    return CHART_COLORS.improvementGreen;
                                }
                                if (comparison === "negative") {
                                    return CHART_COLORS.declineRed;
                                }
                                return theme.line;
                            },
                        },
                    },
                    {
                        label: "Selected Target",
                        targetLabel: "",
                        targetMark: "",
                        data: [],
                        borderColor: "transparent",
                        borderDash: [8, 6],
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        fill: false,
                        tension: 0,
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
                                if (item.dataset.label === "Selected Target") {
                                    return `${item.dataset.targetLabel} ${item.dataset.targetMark}`;
                                }
                                return `Mark ${entries[item.dataIndex].rawValue}`;
                            },
                            afterLabel: function (item) {
                                if (item.dataset.label === "Selected Target") {
                                    return isRunning ? "Benchmark time" : "Benchmark distance";
                                }
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

        const performanceDataset = chart.data.datasets[0];
        const targetDataset = chart.data.datasets[1];
        let activeTargetKey = null;

        function applyScaleRange(selectedTarget = null) {
            const scaleValues = selectedTarget ? [...values, selectedTarget.numericValue] : values;
            const localMin = Math.min(...scaleValues);
            const localMax = Math.max(...scaleValues);
            const localPadding = getPadding(localMin, localMax);
            chart.options.scales.y.min = localMin - localPadding;
            chart.options.scales.y.max = localMax + localPadding;
        }

        function syncTargetRowState() {
            targetRows.forEach((row, key) => {
                row.classList.toggle("chart-detail-row--active", key === activeTargetKey);
            });
        }

        function setActiveTarget(target = null) {
            if (!target) {
                activeTargetKey = null;
                performanceDataset.activeTargetValue = null;
                targetDataset.targetLabel = "";
                targetDataset.targetMark = "";
                targetDataset.data = [];
                targetDataset.borderColor = "transparent";
                applyScaleRange(null);
                syncTargetRowState();
                chart.update();
                return;
            }

            activeTargetKey = target.key;
            performanceDataset.activeTargetValue = target.numericValue;
            targetDataset.targetLabel = target.label;
            targetDataset.targetMark = target.mark;
            targetDataset.data = entries.map(() => target.numericValue);
            targetDataset.borderColor = compareToTarget(last, target.numericValue, isRunning) === "positive"
                ? CHART_COLORS.improvementGreen
                : CHART_COLORS.declineRed;
            targetDataset.borderDash = target.dash;
            applyScaleRange(target);
            syncTargetRowState();
            chart.update();
        }

        if (chartDetails) {
            targets.forEach((target) => {
                const comparison = compareToTarget(best, target.numericValue, isRunning);
                const gapText = comparison === "neutral"
                    ? "At target"
                    : `Gap ${formatDelta(best - target.numericValue, isRunning)}`;
                const targetRow = createDetailRow(target.label, target.mark, {
                    clickable: true,
                    metaText: gapText,
                    metaClassName: comparison === "positive"
                        ? "chart-detail-meta--positive"
                        : comparison === "negative"
                            ? "chart-detail-meta--negative"
                            : "chart-detail-meta--neutral",
                });
                targetRow.addEventListener("click", () => {
                    setActiveTarget(activeTargetKey === target.key ? null : target);
                });
                targetRows.set(target.key, targetRow);
                chartDetails.appendChild(targetRow);
            });
        }
    });

    container.appendChild(chartsSection);
}