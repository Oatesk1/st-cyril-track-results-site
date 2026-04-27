const searchInput = document.getElementById("nameSearch");
const resultsEl = document.getElementById("results");
const statusTextEl = document.getElementById("statusText");
const modeAthletesBtn = document.getElementById("modeAthletes");
const modeQualifiersBtn = document.getElementById("modeQualifiers");
const athleteRecordsViewEl = document.getElementById("athleteRecordsView");
const regionalQualifiersViewEl = document.getElementById("regionalQualifiersView");
const qualifierStatusTextEl = document.getElementById("qualifierStatusText");
const qualifierEventTabsEl = document.getElementById("qualifierEventTabs");
const qualifierResultsEl = document.getElementById("qualifierResults");
let athletes = [];
let athleteGoals = {};
let divisionTargets = {};
let athleteDivisionAssignments = {};
let storedDivisionAssignments = {};
let regionalQualifierData = null;
let activeQualifierEvent = "";
let currentQuery = "";

const DIVISION_ASSIGNMENTS_STORAGE_KEY = "athleteDivisionAssignments";
const DISPLAY_RUNNING_EVENTS = new Set(["100M", "200M", "400M", "800M", "1600M"]);
const DEFAULT_EVENT_ORDER = ["100M", "200M", "400M", "800M", "1600M", "JV", "SP", "LJ"];
const QUALIFIER_EVENT_ORDER = ["100M", "200M", "400M", "800M", "1600M", "Javelin", "Shot Put", "Long Jump"];

function setActiveMode(mode) {
    const showAthletes = mode === "athletes";

    athleteRecordsViewEl.classList.toggle("regional-view--hidden", !showAthletes);
    regionalQualifiersViewEl.classList.toggle("regional-view--hidden", showAthletes);
    modeAthletesBtn.classList.toggle("mode-button--active", showAthletes);
    modeQualifiersBtn.classList.toggle("mode-button--active", !showAthletes);
}

function parseRunningValue(mark) {
    if (typeof mark !== "string") {
        return Number.NaN;
    }

    const parts = mark.split(":").map((part) => Number(part));
    if (parts.some((value) => !Number.isFinite(value))) {
        return Number.NaN;
    }

    if (parts.length === 1) {
        return parts[0];
    }

    return parts.reduce((total, current) => total * 60 + current, 0);
}

function parseFieldValue(mark) {
    if (typeof mark !== "string") {
        return Number.NaN;
    }

    if (!mark.includes("-")) {
        const asFeet = Number(mark);
        return Number.isFinite(asFeet) ? asFeet * 12 : Number.NaN;
    }

    const [feet, inches] = mark.split("-").map((value) => Number(value));
    if (![feet, inches].every(Number.isFinite)) {
        return Number.NaN;
    }

    return feet * 12 + inches;
}

function getRegionalLabel(sourceValue) {
    const source = (sourceValue || "").toLowerCase();

    if (source.includes("st-paul") || source.includes("st paul")) {
        return "St. Paul";
    }

    if (source.includes("st-anthony") || source.includes("st anthony")) {
        return "St. Anthony";
    }

    if (source.includes("regionals-2") || source.includes("regional 2")) {
        return "St. Paul";
    }

    if (source.includes("alemany") || source.includes("regionals-3") || source.includes("regional 3")) {
        return "Alemany";
    }

    if (source.includes("damien") || source.includes("regionals-4") || source.includes("regional 4")) {
        return "Damien";
    }

    if (source.includes("regionals-1") || source.includes("regional 1")) {
        return "St. Anthony";
    }

    return "Regional";
}

function inferQualifierEventType(eventName, sampleMark = "") {
    const name = (eventName || "").toLowerCase();
    const mark = (sampleMark || "").toLowerCase();

    if (DISPLAY_RUNNING_EVENTS.has(eventName)) {
        return "running";
    }

    // Full-title regional event names (for example: "Girls 100 Meter Dash (B)").
    if (
        name.includes("dash")
        || name.includes("meter")
        || name.includes("run")
        || name.includes("relay")
    ) {
        return "running";
    }

    if (
        name.includes("long jump")
        || name.includes("shot put")
        || name.includes("javelin")
        || name.includes("high jump")
    ) {
        return "field";
    }

    // Mark-shape fallback: feet-inches usually indicates field marks.
    if (mark.includes("-")) {
        return "field";
    }

    return "running";
}

function parseRegionalEventMeta(eventName) {
    const name = (eventName || "").toLowerCase();

    const gender = name.includes("girls") ? "Girls" : name.includes("boys") ? "Boys" : "";
    // Support both title styles: (A)/(B) and "A"/"B".
    const divisionMatch = name.match(/\((a|b)\)|"([ab])"/i);
    const division = divisionMatch
        ? (divisionMatch[1] || divisionMatch[2] || "").toUpperCase()
        : "";

    let normalizedEvent = "";
    if (name.includes("100 meter")) normalizedEvent = "100M";
    else if (name.includes("200 meter")) normalizedEvent = "200M";
    else if (name.includes("400 meter")) normalizedEvent = "400M";
    else if (name.includes("800 meter")) normalizedEvent = "800M";
    else if (name.includes("1600 meter")) normalizedEvent = "1600M";
    else if (name.includes("javelin")) normalizedEvent = "Javelin";
    else if (name.includes("shot put")) normalizedEvent = "Shot Put";
    else if (name.includes("long jump")) normalizedEvent = "Long Jump";

    return {
        gender,
        division,
        normalizedEvent,
    };
}

function getQualifierStructuredEvents(eventsMap) {
    const allEventNames = Object.keys(eventsMap);
    const desiredOrder = [];
    const groupKeys = [
        "B|Girls",
        "B|Boys",
        "A|Girls",
        "A|Boys",
    ];

    groupKeys.forEach((groupKey) => {
        const [division, gender] = groupKey.split("|");

        QUALIFIER_EVENT_ORDER.forEach((normalizedEvent) => {
            const match = allEventNames.find((eventName) => {
                const meta = parseRegionalEventMeta(eventName);
                return meta.division === division && meta.gender === gender && meta.normalizedEvent === normalizedEvent;
            });

            if (match && !desiredOrder.includes(match)) {
                desiredOrder.push(match);
            }
        });
    });

    const leftovers = allEventNames.filter((eventName) => !desiredOrder.includes(eventName));
    return {
        orderedEventNames: [...desiredOrder, ...leftovers],
        leftovers,
    };
}

function normalizeRegionalQualifierData(data) {
    if (!data || typeof data !== "object") {
        return null;
    }

    const eventsSource = data.events && typeof data.events === "object"
        ? data.events
        : data.qualifiers && typeof data.qualifiers === "object"
            ? data.qualifiers
            : null;

    if (!eventsSource) {
        return null;
    }

    const sourceMeets = Array.isArray(data.source_meets) ? data.source_meets : [];
    const perMeetCap = Number(data.top_per_meet_per_event);
    const qualifierLimit = Number.isFinite(perMeetCap) && perMeetCap > 0 && sourceMeets.length > 0
        ? perMeetCap * sourceMeets.length
        : 16;

    const normalizedEvents = {};

    Object.entries(eventsSource).forEach(([eventName, entries]) => {
        if (!Array.isArray(entries)) {
            return;
        }

        const firstMark = entries.find((entry) => entry && (entry.mark || entry.result || entry.time || entry.distance))
            ?.mark
            || entries.find((entry) => entry && (entry.mark || entry.result || entry.time || entry.distance))
                ?.result
            || entries.find((entry) => entry && (entry.mark || entry.result || entry.time || entry.distance))
                ?.time
            || entries.find((entry) => entry && (entry.mark || entry.result || entry.time || entry.distance))
                ?.distance
            || "";
        const eventType = inferQualifierEventType(eventName, firstMark);
        const isRunningEvent = eventType === "running";
        const sorted = entries
            .map((entry) => {
                const mark = entry.mark || entry.result || entry.time || entry.distance || "";
                const score = isRunningEvent ? parseRunningValue(mark) : parseFieldValue(mark);

                return {
                    athlete: entry.athlete || entry.name || "Unknown Athlete",
                    team: entry.team || entry.school || "",
                    mark,
                    regional: getRegionalLabel(entry.meet || entry.meet_name || entry.source || ""),
                    score,
                };
            })
            .filter((entry) => entry.mark)
            .sort((left, right) => {
                const leftValid = Number.isFinite(left.score);
                const rightValid = Number.isFinite(right.score);
                if (!leftValid && !rightValid) {
                    return left.athlete.localeCompare(right.athlete);
                }
                if (!leftValid) {
                    return 1;
                }
                if (!rightValid) {
                    return -1;
                }

                return isRunningEvent ? left.score - right.score : right.score - left.score;
            })
            .slice(0, qualifierLimit);

        if (sorted.length > 0) {
            normalizedEvents[eventName] = sorted;
        }
    });

    return {
        generatedAt: data.generated_at || data.generatedAt || "",
        sourceMeets,
        events: normalizedEvents,
    };
}

function getQualifierEventOrder(eventsMap) {
    return getQualifierStructuredEvents(eventsMap).orderedEventNames;
}

function renderQualifierEventTabs() {
    qualifierEventTabsEl.innerHTML = "";

    if (!regionalQualifierData || !regionalQualifierData.events) {
        return;
    }

    const { orderedEventNames } = getQualifierStructuredEvents(regionalQualifierData.events);
    if (orderedEventNames.length === 0) {
        return;
    }

    const grid = document.createElement("div");
    grid.className = "qualifier-pill-grid";

    ["Girls", "Boys"].forEach((gender) => {
        const column = document.createElement("section");
        column.className = "qualifier-pill-column";

        ["B", "A"].forEach((division) => {
            const section = document.createElement("div");
            section.className = "qualifier-pill-section";

            const title = document.createElement("h3");
            title.className = "qualifier-pill-title";
            title.textContent = `${division} ${gender}`;
            section.appendChild(title);

            const buttonWrap = document.createElement("div");
            buttonWrap.className = "event-tabs";

            orderedEventNames.forEach((eventName) => {
                const meta = parseRegionalEventMeta(eventName);
                if (meta.gender !== gender || meta.division !== division) {
                    return;
                }

                const button = document.createElement("button");
                button.type = "button";
                button.className = "event-tab-button";
                button.textContent = meta.normalizedEvent || eventName;
                button.setAttribute("role", "tab");
                button.setAttribute("aria-selected", String(eventName === activeQualifierEvent));
                if (eventName === activeQualifierEvent) {
                    button.classList.add("event-tab-button--active");
                }

                button.addEventListener("click", () => {
                    activeQualifierEvent = eventName;
                    renderRegionalQualifierResults();
                });

                buttonWrap.appendChild(button);
            });

            section.appendChild(buttonWrap);
            column.appendChild(section);
        });

        grid.appendChild(column);
    });

    qualifierEventTabsEl.appendChild(grid);
}

function renderRegionalQualifierResults() {
    qualifierResultsEl.innerHTML = "";

    if (!regionalQualifierData || !regionalQualifierData.events) {
        qualifierStatusTextEl.textContent = "Regional qualifier data not available yet. Add regional_qualifiers.json to enable this view.";
        qualifierEventTabsEl.innerHTML = "";
        return;
    }

    const orderedEvents = getQualifierEventOrder(regionalQualifierData.events);
    if (orderedEvents.length === 0) {
        qualifierStatusTextEl.textContent = "Regional qualifier data loaded, but no event results were found.";
        qualifierEventTabsEl.innerHTML = "";
        return;
    }

    if (!activeQualifierEvent || !regionalQualifierData.events[activeQualifierEvent]) {
        activeQualifierEvent = orderedEvents[0];
    }

    const eventRows = regionalQualifierData.events[activeQualifierEvent] || [];
    qualifierStatusTextEl.textContent = `Showing top ${eventRows.length} for ${activeQualifierEvent}.`;
    renderQualifierEventTabs();

    const sourceText = [];
    if (regionalQualifierData.sourceMeets.length > 0) {
        sourceText.push(`Sources: ${regionalQualifierData.sourceMeets.join(" • ")}`);
    }
    if (regionalQualifierData.generatedAt) {
        sourceText.push(`Updated: ${regionalQualifierData.generatedAt}`);
    }

    if (sourceText.length > 0) {
        const meta = document.createElement("p");
        meta.className = "qualifier-meta";
        meta.textContent = sourceText.join(" | ");
        qualifierResultsEl.appendChild(meta);
    }

    const tableWrap = document.createElement("div");
    tableWrap.className = "qualifier-table-wrap";

    const table = document.createElement("table");
    table.className = "qualifier-table";

    const isMobileView = window.matchMedia("(max-width: 640px)").matches;
    const teamAndMarkHeaderCells = isMobileView
        ? "<th>Mark</th><th>Team</th>"
        : "<th>Team</th><th>Mark</th>";

    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>Rank</th><th>Athlete</th>${teamAndMarkHeaderCells}<th>Regional</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    eventRows.forEach((entry, index) => {
        const row = document.createElement("tr");
        const teamAndMarkCells = isMobileView
            ? `<td>${entry.mark}</td><td>${entry.team || "-"}</td>`
            : `<td>${entry.team || "-"}</td><td>${entry.mark}</td>`;
        row.innerHTML = `<td>${index + 1}</td><td>${entry.athlete}</td>${teamAndMarkCells}<td>${entry.regional || "-"}</td>`;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    tableWrap.appendChild(table);
    qualifierResultsEl.appendChild(tableWrap);
}

function formatRunningMark(mark) {
    if (typeof mark !== "string") {
        return mark;
    }

    const parts = mark.split(":");
    if (parts.length !== 3) {
        return mark;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if (![hours, minutes, seconds].every(Number.isFinite)) {
        return mark;
    }

    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes > 0) {
        return `${totalMinutes}:${seconds.toFixed(2).padStart(5, "0")}`;
    }

    return seconds.toFixed(2);
}

function formatMarkForDisplay(eventName, mark) {
    if (DISPLAY_RUNNING_EVENTS.has(eventName)) {
        return formatRunningMark(mark);
    }

    return mark;
}

function normalizeGoalMap(data) {
    if (!data || typeof data !== "object") {
        return {};
    }

    if (data.goals && typeof data.goals === "object") {
        return data.goals;
    }

    return data;
}

function normalizeDivisionTargets(data) {
    if (!data || typeof data !== "object") {
        return {};
    }

    if (data.groups && typeof data.groups === "object") {
        return data.groups;
    }

    return data;
}

function normalizeDivisionAssignments(data) {
    if (!data || typeof data !== "object") {
        return {};
    }

    if (data.assignments && typeof data.assignments === "object") {
        return data.assignments;
    }

    return data;
}

function loadStoredDivisionAssignments() {
    try {
        const raw = window.localStorage.getItem(DIVISION_ASSIGNMENTS_STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function saveStoredDivisionAssignments(assignments) {
    try {
        window.localStorage.setItem(DIVISION_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
    } catch {
        // Ignore storage failures so the app still works without persistence.
    }
}

function getAvailableDivisionOptions() {
    return Object.entries(divisionTargets)
        .map(([key, value]) => ({ key, label: value.label || key }))
        .sort((left, right) => left.label.localeCompare(right.label));
}

function getAthleteDivisionKey(athlete) {
    return storedDivisionAssignments[athlete.id]
        || athleteDivisionAssignments[athlete.id]
        || athlete.division_key
        || "";
}

function getAthleteDivisionGroup(athlete) {
    const divisionKey = getAthleteDivisionKey(athlete);
    if (!divisionKey || !divisionTargets[divisionKey]) {
        return null;
    }

    return {
        key: divisionKey,
        ...divisionTargets[divisionKey],
    };
}

function getMatches(query) {
    return athletes.filter((athlete) => {
        const name = (athlete.name || "").toLowerCase();
        const searchName = (athlete.search_name || "").toLowerCase();
        return name.includes(query) || searchName.includes(query);
    });
}

function rerenderCurrentResults() {
    renderResults(getMatches(currentQuery), currentQuery);
}

function renderDivisionSelector(athlete) {
    const divisionOptions = getAvailableDivisionOptions();
    if (divisionOptions.length === 0) {
        return null;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "division-selector";

    const label = document.createElement("label");
    label.className = "division-selector-label";
    label.setAttribute("for", `division-${athlete.id}`);
    label.textContent = "Divsion";
    wrapper.appendChild(label);

    const select = document.createElement("select");
    select.className = "division-selector-input";
    select.id = `division-${athlete.id}`;

    const blankOption = document.createElement("option");
    blankOption.value = "";
    blankOption.textContent = "Choose Divsion";
    select.appendChild(blankOption);

    divisionOptions.forEach((option) => {
        const optionEl = document.createElement("option");
        optionEl.value = option.key;
        optionEl.textContent = option.label;
        select.appendChild(optionEl);
    });

    select.value = getAthleteDivisionKey(athlete);
    select.addEventListener("change", () => {
        storedDivisionAssignments = {
            ...storedDivisionAssignments,
            [athlete.id]: select.value,
        };
        saveStoredDivisionAssignments(storedDivisionAssignments);
        rerenderCurrentResults();
    });
    wrapper.appendChild(select);

    const helpText = document.createElement("p");
    helpText.className = "division-selector-help";
    helpText.textContent = "Controls which 2025 CYO benchmark marks are shown with the chart.";
    wrapper.appendChild(helpText);

    return wrapper;
}

async function loadJson(url, errorMessage, { optional = false } = {}) {
    const cacheBuster = new Date().getTime();
    const response = await fetch(`${url}?ts=${cacheBuster}`, {
        cache: "no-store",
    });

    if (!response.ok) {
        if (optional && response.status === 404) {
            return null;
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

function renderPersonalRecordsGrid(records, isPrFromLatestMeet = []) {
    const grid = document.createElement("div");
    grid.className = "pr-grid";

    Object.entries(records).forEach(([eventName, mark]) => {
        const displayMark = formatMarkForDisplay(eventName, mark);
        const item = document.createElement("div");
        item.className = "pr-item";

        const eventEl = document.createElement("span");
        eventEl.className = "pr-event";
        eventEl.textContent = eventName;
        item.appendChild(eventEl);

        const valueWrap = document.createElement("div");
        valueWrap.className = "pr-value-wrap";

        const valueEl = document.createElement("span");
        valueEl.className = "pr-value";
        valueEl.textContent = displayMark;
        valueWrap.appendChild(valueEl);

        if (isPrFromLatestMeet.includes(eventName)) {
            const badge = document.createElement("span");
            badge.className = "pr-badge";
            badge.textContent = "New";
            valueWrap.appendChild(badge);
        }

        item.appendChild(valueWrap);
        grid.appendChild(item);
    });

    return grid;
}

function renderEventList(events, isPrFromLatestMeet = []) {
    const list = document.createElement("ul");
    list.className = "record-list";

    Object.entries(events).forEach(([eventName, mark]) => {
        const displayMark = formatMarkForDisplay(eventName, mark);
        const item = document.createElement("li");
        const isFromLatestMeet = isPrFromLatestMeet.includes(eventName);
        const asterisk = isFromLatestMeet ? '*' : '';
        item.textContent = `${eventName} - ${displayMark}${asterisk}`;
        list.appendChild(item);
    });

    return list;
}

function parseMeetDateValue(dateString) {
    const [month, day, year] = (dateString || "").split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
}

function getSortedResults(results = []) {
    return [...results].sort((left, right) => parseMeetDateValue(right.meet_date) - parseMeetDateValue(left.meet_date));
}

function renderMeetHistory(results = []) {
    if (results.length <= 1) {
        return null;
    }

    const details = document.createElement("details");
    details.className = "meet-history";

    const summary = document.createElement("summary");
    summary.className = "meet-history-summary";
    summary.textContent = `Show all meet history (${results.length} meets)`;
    details.appendChild(summary);

    const historyList = document.createElement("div");
    historyList.className = "meet-history-list";

    results.forEach((result, index) => {
        const item = document.createElement("section");
        item.className = "meet-history-item";

        const header = document.createElement("div");
        header.className = "meet-history-item-header";

        const title = document.createElement("p");
        title.className = "meet-history-item-title";
        title.textContent = result.meet_name || `Meet ${index + 1}`;
        header.appendChild(title);

        const meta = document.createElement("p");
        meta.className = "meet-history-item-date";
        meta.textContent = result.meet_date || "Date unavailable";
        header.appendChild(meta);

        item.appendChild(header);
        item.appendChild(renderEventList(result.events || {}));
        historyList.appendChild(item);
    });

    details.appendChild(historyList);
    return details;
}

function renderResults(matches, query) {
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
        const sortedResults = getSortedResults(athlete.results || []);
        const athleteGoalMap = athleteGoals[athlete.id] || athleteGoals[athlete.search_name] || athleteGoals[athlete.name] || {};
        const athleteDivisionGroup = getAthleteDivisionGroup(athlete);
        const card = document.createElement("article");
        card.className = "result-card";

        const title = document.createElement("h3");
        title.textContent = athlete.name;
        card.appendChild(title);

        const personalRecords = athlete.personal_records || {};
        const personalRecordKeys = Object.keys(personalRecords);

        if (personalRecordKeys.length > 0) {
            const prLabel = document.createElement("p");
            prLabel.className = "section-label";
            prLabel.textContent = "Personal Records";
            card.appendChild(prLabel);
            const prFromLatestMeet = athlete.pr_from_latest_meet || [];
            if (prFromLatestMeet.length > 0) {
                hasAsterisk = true;
            }
            card.appendChild(renderPersonalRecordsGrid(personalRecords, prFromLatestMeet));
        }

        const latestResult = sortedResults.find((result) => result.is_latest_meet) || sortedResults[0];

        if (latestResult && latestResult.events) {
            const latestLabel = document.createElement("p");
            latestLabel.className = "section-label";
            latestLabel.textContent = `Latest Meet: ${latestResult.meet_name} (${latestResult.meet_date})`;
            card.appendChild(latestLabel);
            card.appendChild(renderEventList(latestResult.events));
        }

        const meetHistory = renderMeetHistory(sortedResults);
        if (meetHistory) {
            const historyLabel = document.createElement("p");
            historyLabel.className = "section-label";
            historyLabel.textContent = "Meet History";
            card.appendChild(historyLabel);
            card.appendChild(meetHistory);
        }

        const divisionSelector = renderDivisionSelector(athlete);
        if (divisionSelector) {
            card.appendChild(divisionSelector);
        }

        if (typeof renderAthleteCharts === "function") {
            renderAthleteCharts(athlete, card, {
                customGoals: athleteGoalMap,
                divisionGroup: athleteDivisionGroup,
            });
        }

        resultsEl.appendChild(card);
    });

    // Add footnote if there are asterisks
    if (hasAsterisk) {
        const footnote = document.createElement("div");
        footnote.className = "footnote";
        footnote.innerHTML = '<p><small>New marks were set in the most recent competition.</small></p>';
        resultsEl.appendChild(footnote);
    }
}

searchInput.addEventListener("input", (event) => {
    currentQuery = event.target.value.trim().toLowerCase();
    renderResults(getMatches(currentQuery), currentQuery);
});

async function loadAthletes() {
    try {
        const [data, goalsData, divisionTargetsData, divisionAssignmentsData, regionalQualifierRawData] = await Promise.all([
            loadJson("./athlete_records.json", "Could not load athlete_records.json"),
            loadJson("./athlete_goals.json", "Could not load athlete_goals.json", { optional: true }),
            loadJson("./division_targets.json", "Could not load division_targets.json", { optional: true }),
            loadJson("./athlete_divisions.json", "Could not load athlete_divisions.json", { optional: true }),
            loadJson("./regional_qualifiers.json", "Could not load regional_qualifiers.json", { optional: true }),
        ]);

        athletes = Array.isArray(data.athletes) ? data.athletes : [];
        athleteGoals = normalizeGoalMap(goalsData);
        divisionTargets = normalizeDivisionTargets(divisionTargetsData);
        athleteDivisionAssignments = normalizeDivisionAssignments(divisionAssignmentsData);
        regionalQualifierData = normalizeRegionalQualifierData(regionalQualifierRawData);
        storedDivisionAssignments = loadStoredDivisionAssignments();
        statusTextEl.textContent = "Start typing to search.";
        renderRegionalQualifierResults();
    } catch (error) {
        statusTextEl.textContent = "Could not load athlete data. Check athlete_records.json and run with a local server.";
        qualifierStatusTextEl.textContent = "Could not load regional qualifier data.";
    }
}

modeAthletesBtn.addEventListener("click", () => {
    setActiveMode("athletes");
});

modeQualifiersBtn.addEventListener("click", () => {
    setActiveMode("qualifiers");
});

window.matchMedia("(max-width: 640px)").addEventListener("change", () => {
    if (!regionalQualifiersViewEl.classList.contains("regional-view--hidden")) {
        renderRegionalQualifierResults();
    }
});

setActiveMode("athletes");

loadAthletes();
