# Daily Dose

A tracker for medications and rehab exercises. Add what you take or do, check
it off each day, and watch the streaks build.

**Live app:** <https://sabrinashehreen-prog.github.io/Daily-Dose-Tracker/>

Built with plain HTML, CSS and JavaScript. No framework, no build step, no
server, no account.

## What it does

- Add medicines and exercises with a dose and a time of day
- Check items off for today with one tap
- Groups by Morning / Afternoon / Evening / Night, each with its own counter
- Current streak, best streak, and misses in the last 7 days
- A month calendar per item showing every day you did it
- Export and import a backup file
- Installs to a phone home screen and opens offline

## Your data

Everything stays in your own browser's `localStorage`. Nothing is uploaded,
and there is no account or server. That also means a browser that clears its
storage clears your history, so **use Export backup now and then** - that file
is the only copy you own.

## Run it locally

A service worker only runs over `https` or `localhost`, so opening the file
directly with `file://` works but skips the offline part. To get the real
thing:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploying an update

The service worker caches the app so it opens offline. When you push a change,
bump `VERSION` in `sw.js` (`"v2"` to `"v3"`, and so on) so the old cache is
thrown away and people get the new version on their next visit.

## Project layout

| File | What lives there |
|---|---|
| `index.html` | Page structure and the add form |
| `styles.css` | The whole dark theme |
| `storage.js` | Reading and writing `localStorage` |
| `app.js` | State, rendering, streak and calendar maths |
| `sw.js` | Offline caching |
| `manifest.json` | Name, icons and colors for home-screen install |
