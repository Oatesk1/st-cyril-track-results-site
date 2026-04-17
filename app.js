const searchInput = document.getElementById("nameSearch");
const resultsEl = document.getElementById("results");
const statusTextEl = document.getElementById("statusText");
let athletes = [];
let athleteGoals = {};
let divisionTargets = {};
let athleteDivisionAssignments = {};
let storedDivisionAssignments = {};
let currentQuery = "";

const DIVISION_ASSIGNMENTS_STORAGE_KEY = "athleteDivisionAssignments";

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
        valueEl.textContent = mark;
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
        const item = document.createElement("li");
        const isFromLatestMeet = isPrFromLatestMeet.includes(eventName);
        const asterisk = isFromLatestMeet ? '*' : '';
        item.textContent = `${eventName} - ${mark}${asterisk}`;
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
        const [data, goalsData, divisionTargetsData, divisionAssignmentsData] = await Promise.all([
            loadJson("./athlete_records.json", "Could not load athlete_records.json"),
            loadJson("./athlete_goals.json", "Could not load athlete_goals.json", { optional: true }),
            loadJson("./division_targets.json", "Could not load division_targets.json", { optional: true }),
            loadJson("./athlete_divisions.json", "Could not load athlete_divisions.json", { optional: true }),
        ]);

        athletes = Array.isArray(data.athletes) ? data.athletes : [];
        athleteGoals = normalizeGoalMap(goalsData);
        divisionTargets = normalizeDivisionTargets(divisionTargetsData);
        athleteDivisionAssignments = normalizeDivisionAssignments(divisionAssignmentsData);
        storedDivisionAssignments = loadStoredDivisionAssignments();
        statusTextEl.textContent = "Start typing to search.";
    } catch (error) {
        statusTextEl.textContent = "Could not load athlete data. Check athlete_records.json and run with a local server.";
    }
}

loadAthletes();
