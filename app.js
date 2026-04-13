const searchInput = document.getElementById("nameSearch");
const resultsEl = document.getElementById("results");
const statusTextEl = document.getElementById("statusText");
let athletes = [];

function renderEventList(events) {
    const list = document.createElement("ul");
    list.className = "record-list";

    Object.entries(events).forEach(([eventName, mark]) => {
        const item = document.createElement("li");
        item.textContent = `${eventName} - ${mark}`;
        list.appendChild(item);
    });

    return list;
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
            card.appendChild(renderEventList(personalRecords));
        }

        const latestResult = (athlete.results || []).find((result) => result.is_latest_meet) || (athlete.results || [])[0];

        if (latestResult && latestResult.events) {
            const latestLabel = document.createElement("p");
            latestLabel.textContent = `Latest Meet: ${latestResult.meet_name} (${latestResult.meet_date})`;
            card.appendChild(latestLabel);
            card.appendChild(renderEventList(latestResult.events));
        }

        resultsEl.appendChild(card);
    });
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
