// app.js: state, rendering, streak and calendar maths.

const items = loadItems();

const list = document.getElementById("list");
const datePill = document.getElementById("date-pill");
const encourage = document.getElementById("encourage");
const progressCount = document.getElementById("progress-count");
const progressFill = document.getElementById("progress-fill");

// The four groups, in the order they appear on screen.
const TIMES = [
    { key: "morning", label: "Morning", icon: "\u{1F305}" },
    { key: "afternoon", label: "Afternoon", icon: "☀️" },
    { key: "evening", label: "Evening", icon: "\u{1F306}" },
    { key: "night", label: "Night", icon: "\u{1F319}" }
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Which calendars are open, and which month each is showing.
// This is screen state, not data - it is never saved, and it resets on reload.
const openCalendars = new Set();
const calendarMonth = new Map();

/* ---------- date helpers ---------- */

// Any Date as "YYYY-MM-DD" in LOCAL time.
// toISOString() formats in UTC, so an evening check-off in Utah (UTC-7) would
// otherwise be stamped with tomorrow's date. Shifting the clock by the local
// offset first makes the date flip at local midnight instead.
function keyFromDate(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
}

// Today as "YYYY-MM-DD" - the format every date in checkedDates uses.
function todayString() {
    return keyFromDate(new Date());
}

// Turn a "YYYY-MM-DD" string back into a Date, pinned to UTC midnight
// so day arithmetic never drifts by an hour.
function dateFromKey(key) {
    return new Date(key + "T00:00:00Z");
}

// Whole days from aKey to bKey. Negative if bKey is earlier.
function daysBetween(aKey, bKey) {
    return Math.round((dateFromKey(bKey) - dateFromKey(aKey)) / 86400000);
}

/* ---------- badges: all calculated from checkedDates, never stored ---------- */

// How many days in a row, counting back from today, this item was checked off.
function currentStreak(item) {
    let streak = 0;
    const d = new Date();

    while (true) {
        const key = keyFromDate(d);

        if (!item.checkedDates.includes(key)) {
            break;
        }

        streak++;
        d.setDate(d.getDate() - 1);
    }

    return streak;
}

// The longest run of consecutive days this item has ever had.
function bestStreak(item) {
    const keys = [...new Set(item.checkedDates)].sort();
    let best = 0;
    let run = 0;

    keys.forEach((key, i) => {
        if (i > 0 && daysBetween(keys[i - 1], key) === 1) {
            run++;
        } else {
            run = 1;
        }

        if (run > best) {
            best = run;
        }
    });

    return best;
}

// Days in the last week that went unchecked. Today is excluded - the day
// isn't over yet, so it isn't a miss. Days before the item existed don't count.
function missesThisWeek(item) {
    const startKey = keyFromDate(new Date(item.id));
    const d = new Date();
    let misses = 0;

    for (let i = 0; i < 7; i++) {
        d.setDate(d.getDate() - 1);
        const key = keyFromDate(d);

        if (key >= startKey && !item.checkedDates.includes(key)) {
            misses++;
        }
    }

    return misses;
}

function isDoneToday(item) {
    return item.checkedDates.includes(todayString());
}

/* ---------- small builders ---------- */

function el(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }
    if (text !== undefined) {
        node.textContent = text;
    }

    return node;
}

/* ---------- header and progress ---------- */

function renderDatePill() {
    const now = new Date();
    datePill.textContent =
        `\u{1F4C5} Today · ${DAY_NAMES[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function renderProgress() {
    const done = items.filter(isDoneToday).length;
    const total = items.length;

    progressCount.textContent = `${done}/${total}`;
    progressFill.style.width = total === 0 ? "0%" : `${(done / total) * 100}%`;

    if (total === 0) {
        encourage.textContent = "Nothing tracked yet. Add your first one below.";
    } else if (done === total) {
        encourage.textContent = "Everything done today. That's the whole list.";
    } else {
        encourage.textContent = "Every check-off counts. You've got this.";
    }
}

/* ---------- calendar ---------- */

// Day 1 of the month being viewed.
// setDate(1) runs first so setMonth can never overflow (e.g. Jan 31 -> Mar 3).
function monthStart(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d;
}

// One month grid for a single item: its own check-off history, nothing else.
function renderCalendar(item) {
    const offset = calendarMonth.get(item.id) || 0;
    const first = monthStart(offset);
    const year = first.getFullYear();
    const month = first.getMonth();
    // Day 0 of the NEXT month is the last day of this one.
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = todayString();

    const prev = el("button", "cal-nav", "‹");
    prev.addEventListener("click", () => {
        calendarMonth.set(item.id, offset - 1);
        render();
    });

    const next = el("button", "cal-nav", "›");
    // Nothing to see in the future, so don't walk forward past now.
    next.disabled = offset >= 0;
    next.addEventListener("click", () => {
        calendarMonth.set(item.id, offset + 1);
        render();
    });

    const nav = el("div", "cal-nav-bar");
    nav.appendChild(prev);
    nav.appendChild(el("span", "cal-month", `${MONTHS[month]} ${year}`));
    nav.appendChild(next);

    const grid = el("div", "calendar");

    WEEKDAYS.forEach((letter) => {
        grid.appendChild(el("span", "cal-head", letter));
    });

    // Empty cells so day 1 lands under the correct weekday column.
    for (let i = 0; i < first.getDay(); i++) {
        grid.appendChild(el("span"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const key = keyFromDate(new Date(year, month, day));
        let cls = "cal-day";

        // ISO dates sort as plain strings, so > is a valid "is it later" test.
        if (item.checkedDates.includes(key)) {
            cls += " checked";
        }
        if (key === todayKey) {
            cls += " today";
        }
        if (key > todayKey) {
            cls += " future";
        }

        grid.appendChild(el("span", cls, day));
    }

    const panel = el("div", "cal-panel");
    panel.appendChild(nav);
    panel.appendChild(grid);
    return panel;
}

/* ---------- one item card ---------- */

function renderCard(item) {
    const card = el("article", "card");
    const done = isDoneToday(item);

    // --- the check-off circle ---
    const circle = el("button", done ? "circle checked" : "circle");
    circle.textContent = done ? "✓" : "";
    // A tick mark is not a label. Screen readers read this instead.
    circle.setAttribute("aria-label",
        `${done ? "Uncheck" : "Check off"} ${item.name} for today`);
    circle.addEventListener("click", () => {
        if (done) {
            // Remove today: find where it sits, then cut one element out.
            const i = item.checkedDates.indexOf(todayString());
            item.checkedDates.splice(i, 1);
        } else {
            item.checkedDates.push(todayString());
        }

        saveItems(items);
        render();
    });

    // --- name, type chip, dose ---
    const chipText = item.type === "exercise" ? "\u{1F3C3} Exercise" : "\u{1F48A} Med";

    const titleRow = el("div", "title-row");
    titleRow.appendChild(el("h3", "card-name", item.name));
    titleRow.appendChild(el("span", "chip", chipText));

    const body = el("div", "card-body");
    body.appendChild(titleRow);
    body.appendChild(el("p", "dose", item.dose));

    const head = el("div", "card-head");
    head.appendChild(circle);
    head.appendChild(body);

    // --- calculated badges ---
    const misses = missesThisWeek(item);
    const streak = currentStreak(item);

    const badges = el("div", "badges");
    badges.appendChild(el("span", "badge badge-streak",
        `\u{1F525} ${streak} ${streak === 1 ? "day" : "days"}`));
    badges.appendChild(el("span", "badge badge-best", `\u{1F3C6} Best ${bestStreak(item)}`));
    badges.appendChild(el("span", misses === 0 ? "badge badge-clean" : "badge badge-miss",
        misses === 0 ? "No misses this week"
            : `${misses} ${misses === 1 ? "miss" : "misses"} this week`));

    const isOpen = openCalendars.has(item.id);

    const calLink = el("button", "link", isOpen ? "Hide calendar" : "Calendar");
    calLink.addEventListener("click", () => {
        if (isOpen) {
            openCalendars.delete(item.id);
        } else {
            openCalendars.add(item.id);
        }
        render();
    });

    const removeLink = el("button", "link link-danger", "Remove");
    removeLink.addEventListener("click", () => {
        if (!confirm(`Remove "${item.name}"? Its history goes too.`)) {
            return;
        }

        // Find it by id, not by position - positions shift as items are removed.
        const i = items.findIndex((other) => other.id === item.id);
        items.splice(i, 1);
        openCalendars.delete(item.id);

        saveItems(items);
        render();
    });

    badges.appendChild(calLink);
    badges.appendChild(removeLink);

    card.appendChild(head);
    card.appendChild(badges);

    if (isOpen) {
        card.appendChild(renderCalendar(item));
    }

    return card;
}

/* ---------- the list ---------- */

function renderItems() {
    list.innerHTML = "";

    TIMES.forEach((time) => {
        const group = items.filter((item) => item.timeOfDay === time.key);

        if (group.length === 0) {
            return;
        }

        const heading = el("h2", "group-head");
        heading.appendChild(el("span", "group-icon", time.icon));
        heading.appendChild(el("span", undefined, time.label));
        heading.appendChild(el("span", "group-count",
            `${group.filter(isDoneToday).length}/${group.length}`));

        const grid = el("div", "card-grid");
        group.forEach((item) => grid.appendChild(renderCard(item)));

        const section = el("section", "group");
        section.appendChild(heading);
        section.appendChild(grid);
        list.appendChild(section);
    });
}

// One call that redraws everything that depends on items.
function render() {
    renderProgress();
    renderItems();
}

renderDatePill();
render();

/* ---------- the add form ---------- */

const form = document.getElementById("entry-form");
const addToggle = document.getElementById("add-toggle");
const cancelAdd = document.getElementById("cancel-add");

function showForm(show) {
    form.hidden = !show;
    addToggle.hidden = show;

    if (show) {
        document.getElementById("name").focus();
    }
}

addToggle.addEventListener("click", () => showForm(true));
cancelAdd.addEventListener("click", () => {
    form.reset();
    showForm(false);
});

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const newItem = {
        id: Date.now(),
        name: document.getElementById("name").value.trim(),
        type: document.getElementById("type").value,
        dose: document.getElementById("dose").value.trim(),
        timeOfDay: document.getElementById("timeOfDay").value,
        checkedDates: []
    };

    items.push(newItem);
    saveItems(items);

    render();
    form.reset();
    showForm(false);
});

/* ---------- backup: export and import ---------- */

// Hand the user a .json file holding everything. The browser can clear
// localStorage whenever it likes, so this file is the only copy they own.
function exportBackup() {
    const text = JSON.stringify(items, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // There is no "save a file" function in JS. The trick is to build a link
    // pointing at the blob, give it a download name, and click it.
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-dose-backup-${todayString()}.json`;
    link.click();

    // Hand the memory back, or the blob lives until the tab closes.
    URL.revokeObjectURL(url);
}

document.getElementById("export-btn").addEventListener("click", exportBackup);

// A real <input type="file"> cannot be styled, so it stays hidden and our
// own button clicks it instead.
const importFile = document.getElementById("import-file");

document.getElementById("import-btn").addEventListener("click", () => {
    importFile.click();
});

importFile.addEventListener("change", () => {
    const file = importFile.files[0];

    if (file) {
        importBackup(file);
    }

    // Clearing the value means picking the SAME file twice still fires change.
    importFile.value = "";
});

/* ---------- make it installable ---------- */

// Registering the service worker is what lets the phone add this to the home
// screen and open it with no connection. It only works over https (or
// localhost) - opening index.html with file:// will skip this silently.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js");
    });
}
