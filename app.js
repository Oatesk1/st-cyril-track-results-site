const searchInput = document.getElementById("nameSearch");
const resultsEl = document.getElementById("results");
const statusTextEl = document.getElementById("statusText");
let athletes = [];

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

        if (typeof renderAthleteCharts === "function") {
            renderAthleteCharts(athlete, card);
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
