// storage.js: load / save items in localStorage (Goal 4).
const STORAGE_KEY = "dailyDoseItems";

function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadItems() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
        return JSON.parse(raw);
    }
    return [];
}
