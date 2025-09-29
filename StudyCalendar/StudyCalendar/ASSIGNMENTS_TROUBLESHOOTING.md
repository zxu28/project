## Canvas Assignments Not Showing Up – Troubleshooting

This document explains common reasons why Canvas assignments might not appear in the StudyCalendar web app, and how to verify/fix each issue.

### How it works (quick recap)
- The app calls a Google Apps Script proxy (`CANVAS_PROXY_URL`) instead of hitting Canvas directly.
- The proxy returns Canvas calendar events JSON.
- The app treats each returned item as an assignment and merges it into `events[YYYY-MM-DD].assignments`.
- The calendar shows colored dots per date (red for Canvas assignments). The daily list and List view render these items.

### Current request path
- Proxy URL used: `CANVAS_PROXY_URL` in `App.js`.
- Fetch range: from 30 days in the past to 120 days in the future.
- Example request: `...?endpoint=calendar_events&type=assignment&per_page=50&start_date=ISO&end_date=ISO`

### Common reasons assignments don’t appear
1) Proxy not configured or not deployed
   - If the Apps Script isn’t deployed, or the URL is wrong, the request fails or returns HTML instead of JSON.
   - Check browser DevTools → Network → the request to the Apps Script. Verify status 200 and a JSON array response.

2) Proxy not pointing to the correct Canvas host or token
   - The Apps Script must know your institution’s Canvas base URL and a valid API token server-side.
   - If misconfigured, the proxy may return an empty array or 401/403.
   - Fix: update the Apps Script to use the correct host and token, then redeploy.

3) Date window excludes your assignments
   - We request from 30 days ago to 120 days ahead. If your assignments fall outside this window, they won’t show.
   - Fix: widen the range in `fetchCanvasAssignments` if needed.

4) Response format is not an array or fields are missing
   - The app expects an array of items. If the proxy returns an object (e.g., `{ error: ... }`), they will be ignored.
   - Required fields: `end_at` or `start_at` (we also check `all_day_date`), and `title` (or `assignment.title`). Missing/invalid dates are skipped.

5) Items are filtered as duplicates
   - We deduplicate by `title + time + type`. If two items share these, only one is kept.
   - Slight time differences or missing times can affect dedup; verify the actual `time` values being parsed.

6) Concurrent fetches previously overwrote state
   - Now fixed. We use functional `setEvents` to merge Canvas/Google/ICS to avoid overwriting.

7) List view filters hide items
   - If `Filter by class`, `From/To`, or `Category` are set, assignments may be filtered out. Clear filters to verify.

8) Timezone/date parsing
   - We derive the date key from `end_at || start_at || all_day_date`. If the ISO is malformed or timezone-skewed, items can be dropped or land on an unexpected date.

### What to check (step-by-step)
1) Open DevTools → Network
   - Find the Apps Script request. Confirm 200 status and a JSON array body.
   - Spot-check an event object for fields: `title` (or `assignment.title`), `end_at` or `start_at`, `context_name`.

2) Open DevTools → Console
   - Look for warnings: `Canvas response not an array` or errors like `HTTP 401/403`.

3) Confirm dots on the calendar
   - Canvas assignments add a red dot on dates. If no dots appear, verify `getMarkedDates` is running and that items have `type: 'assignment'` and `source: 'canvas'`.

4) Clear filters in List view
   - Remove class/date/category filters to ensure items aren’t hidden.

5) Validate date range
   - Ensure assignment due dates fall within the 30-days-back to 120-days-forward window.

### Known issues and mitigations
- Proxy configuration: If 401/403 or empty results, fix the Apps Script host/token and redeploy.
- Large course loads: `per_page=50` may be too small. Increase if needed in `fetchCanvasAssignments`.
- All-day vs timed events: Some Canvas items use `all_day_date`. We already check it, but malformed dates will be skipped.
- Timezone differences: Due dates may appear a day off depending on time zone. Adjust parsing if required.

### If it still doesn’t show
- Share a sample of the JSON returned by the proxy (sanitize personal info). We’ll adjust the parsing to match your data shape.
- Provide a specific due date/title you expect to see so we can trace it through the merging and rendering.


