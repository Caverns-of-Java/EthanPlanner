const API_BASE_URL = "https://script.google.com/macros/s/AKfycbyhSTtNEPFCqcTvKzOjaZ5zBLocSMwjGTaz4EQsJIxj3k_sKKgt7Da_eBXAkMzPYf6Slw/exec";
const DEFAULT_COLOUR = "#e75480";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sanitiseColourValue(colour) {
  const value = String(colour || "").trim().toLowerCase();
  if (!value) {
    return DEFAULT_COLOUR;
  }

  const withHash = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash : DEFAULT_COLOUR;
}

function buildUrl(path, query = {}) {
  if (!API_BASE_URL) {
    throw new Error("Missing API base URL. Update js/app.js with your Apps Script /exec URL.");
  }

  const url = new URL(API_BASE_URL);
  const fullQuery = { ...query, route: path };

  Object.entries(fullQuery).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function request(path, { method = "GET", query = {}, body } = {}) {
  const safeQuery = method === "GET"
    ? { ...query, _ts: Date.now() }
    : query;
  const url = buildUrl(path, safeQuery);
  const options = { method };

  if (method === "GET") {
    options.cache = "no-store";
  }

  const safeBody = body ? { ...body } : body;
  if (safeBody && safeBody.type === "colour") {
    safeBody.colour = sanitiseColourValue(safeBody.colour);
  }

  if (method !== "GET" && safeBody) {
    const formBody = new URLSearchParams();
    Object.entries(safeBody).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formBody.set(key, String(value));
      }
    });

    options.headers = {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    };
    options.body = formBody.toString();
  }

  const res = await fetch(url, options);
  const json = await res.json();

  if (!res.ok || json.ok === false) {
    const errorMsg = json.error || `Request failed: ${res.status}`;
    const details = json.details ? ` (${json.details})` : "";
    console.error("[EthanPlanner] Request failed:", errorMsg, details, "Full response:", json);
    throw new Error(errorMsg + details);
  }

  return json;
}

async function getEntries(date) {
  return request("entries", { query: { date } });
}

async function getEntriesInRange(startDate, endDate) {
  return request("entries", {
    query: {
      start_date: startDate,
      end_date: endDate,
    },
  });
}

async function createEntry(entry) {
  return request("entries", { method: "POST", body: entry });
}

async function deleteEntry(id) {
  return request("entries", {
    method: "POST",
    body: { _method: "DELETE", id },
  });
}

async function updateEntry(id, payload) {
  return request("entries", {
    method: "POST",
    body: { _method: "PATCH", id, ...payload },
  });
}

function openEditEntryDialog(entry) {
  if (entry.type === "task") {
    document.getElementById("taskTitle").value = entry.title || "";
    document.getElementById("taskNotes").value = entry.notes || "";
    document.getElementById("taskTitle").dataset.entryId = entry.id;
    els.addTaskForm.dataset.editing = "true";
  } else if (entry.type === "journal") {
    document.getElementById("journalNotes").value = entry.notes || "";
    document.getElementById("journalNotes").dataset.entryId = entry.id;
    els.addJournalForm.dataset.editing = "true";
  }
}

async function getLegend() {
  return request("legend");
}

async function upsertLegend(payload) {
  return request("legend", { method: "POST", body: payload });
}

async function deleteLegend(colour) {
  return request("legend", {
    method: "POST",
    body: { _method: "DELETE", colour },
  });
}

function toMondayIndex(day) {
  return (day + 6) % 7;
}

function renderWeekdays(container) {
  container.innerHTML = "";
  WEEKDAYS.forEach((weekday) => {
    const el = document.createElement("div");
    el.className = "weekday-cell";
    el.textContent = weekday;
    container.appendChild(el);
  });
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(anchorDate) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstGridDay = new Date(firstOfMonth);
  firstGridDay.setDate(firstGridDay.getDate() - toMondayIndex(firstOfMonth.getDay()));

  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const currentDay = new Date(firstGridDay);
    currentDay.setDate(firstGridDay.getDate() + index);
    days.push({
      isoDate: formatISODate(currentDay),
      day: currentDay.getDate(),
      inMonth: currentDay.getMonth() === month,
    });
  }

  return days;
}

function hexToRgba(colour, alpha) {
  const value = sanitiseColourValue(colour);
  const hex = value.replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function renderMonthGrid({
  anchorDate,
  gridElement,
  monthLabelElement,
  indicatorsByDate,
}) {
  const days = buildMonthGrid(anchorDate);
  const monthText = anchorDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  monthLabelElement.textContent = monthText;
  gridElement.innerHTML = "";

  days.forEach((dayInfo) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `calendar-cell${dayInfo.inMonth ? "" : " outside-month"}`;
    cell.dataset.date = dayInfo.isoDate;

    const chips = document.createElement("div");
    chips.className = "cell-chips";

    const dateIndicators = indicatorsByDate.get(dayInfo.isoDate) || {
      colours: [],
      taskCount: 0,
      hasJournal: false,
    };

    const primaryColour = dateIndicators.colours.length > 0
      ? sanitiseColourValue(dateIndicators.colours[dateIndicators.colours.length - 1])
      : "";

    if (primaryColour) {
      cell.classList.add("has-colour-fill");
      cell.style.backgroundColor = hexToRgba(primaryColour, 0.2);
      cell.style.borderColor = hexToRgba(primaryColour, 0.45);
    }

    dateIndicators.colours.slice(0, 4).forEach((colour) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.backgroundColor = colour;
      chips.appendChild(chip);
    });

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(dayInfo.day);

    const meta = document.createElement("div");
    meta.className = "cell-meta";
    const taskText = dateIndicators.taskCount > 0 ? `${dateIndicators.taskCount} task` : "";
    const journalText = dateIndicators.hasJournal ? "Journal" : "";
    meta.textContent = [taskText, journalText].filter(Boolean).join(" • ");

    cell.append(number, chips, meta);
    gridElement.append(cell);
  });
}

console.log("[EthanPlanner] app.js loaded");

let state = {
  monthAnchor: new Date(),
  selectedDate: formatISODate(new Date()),
  indicatorsByDate: new Map(),
  entriesByDate: new Map(),
  legend: [],
  selectedColour: DEFAULT_COLOUR,
  dragActive: false,
  dragMoved: false,
  suppressNextClick: false,
  panelRequestId: 0,
  panelLoading: false,
  dragQueue: Promise.resolve(),
  dragTouchedDates: new Set(),
  pointerDate: null,
};

function setDebugStatus(text) {
  const el = document.getElementById("debugStatus");
  if (el) {
    el.textContent = text;
  }
  console.log("[EthanPlanner]", text);
}

setDebugStatus("State initialized, running init...");

const els = {
  weekdayRow: document.getElementById("weekdayRow"),
  monthLabel: document.getElementById("monthLabel"),
  grid: document.getElementById("calendarGrid"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  quickColour: document.getElementById("quickColour"),
  dateDialog: document.getElementById("dateDialog"),
  panelDateLabel: document.getElementById("panelDateLabel"),
  closeDateDialog: document.getElementById("closeDateDialog"),
  taskList: document.getElementById("taskList"),
  journalList: document.getElementById("journalList"),
  colourChipList: document.getElementById("colourChipList"),
  addTaskForm: document.getElementById("addTaskForm"),
  addJournalForm: document.getElementById("addJournalForm"),
  addColourForm: document.getElementById("addColourForm"),
  colourInput: document.getElementById("colourInput"),
  legendButton: document.getElementById("legendButton"),
  legendDialog: document.getElementById("legendDialog"),
  closeLegendDialog: document.getElementById("closeLegendDialog"),
  legendList: document.getElementById("legendList"),
  legendForm: document.getElementById("legendForm"),
  legendColour: document.getElementById("legendColour"),
  legendLabel: document.getElementById("legendLabel"),
};

function normaliseHex(colour) {
  return colour?.trim().toLowerCase();
}

function isValidHexColour(colour) {
  return /^#[0-9a-f]{6}$/i.test(colour || "");
}

function getSafeColour(colour) {
  const value = normaliseHex(colour);
  return isValidHexColour(value) ? value : DEFAULT_COLOUR;
}

function getPrimaryIndicatorColour(dateIndicators) {
  if (!dateIndicators || !Array.isArray(dateIndicators.colours) || dateIndicators.colours.length === 0) {
    return "";
  }

  return getSafeColour(dateIndicators.colours[dateIndicators.colours.length - 1]);
}

function getCellMetaText(dateIndicators) {
  const taskText = dateIndicators.taskCount > 0 ? `${dateIndicators.taskCount} task` : "";
  const journalText = dateIndicators.hasJournal ? "Journal" : "";
  return [taskText, journalText].filter(Boolean).join(" • ");
}

function applyIndicatorsToCell(cell, dateIndicators) {
  const safeIndicators = dateIndicators || {
    colours: [],
    taskCount: 0,
    hasJournal: false,
  };
  const primaryColour = getPrimaryIndicatorColour(safeIndicators);
  const meta = cell.querySelector(".cell-meta");

  if (meta) {
    meta.textContent = getCellMetaText(safeIndicators);
  }

  if (primaryColour) {
    cell.classList.add("has-colour-fill");
    cell.style.backgroundColor = hexToRgba(primaryColour, 0.18);
    cell.style.borderColor = hexToRgba(primaryColour, 0.42);
  } else {
    cell.classList.remove("has-colour-fill");
    cell.style.backgroundColor = "";
    cell.style.borderColor = "";
  }
}

function coerceLegendItem(item) {
  const rawColour = item && item.colour ? String(item.colour).trim() : "";
  const rawLabel = item && item.label ? String(item.label).trim() : "";
  const directColour = normaliseHex(rawColour);
  const swappedColour = normaliseHex(rawLabel);

  if (isValidHexColour(directColour)) {
    return {
      colour: directColour,
      label: rawLabel,
    };
  }

  if (isValidHexColour(swappedColour)) {
    return {
      colour: swappedColour,
      label: rawColour,
    };
  }

  return {
    colour: DEFAULT_COLOUR,
    label: rawLabel || rawColour || "Unlabelled",
  };
}

function normaliseEntry(entry) {
  return {
    id: String(entry && entry.id ? entry.id : ""),
    date: String(entry && entry.date ? entry.date : state.selectedDate),
    type: String(entry && entry.type ? entry.type : ""),
    title: String(entry && entry.title ? entry.title : ""),
    notes: String(entry && entry.notes ? entry.notes : ""),
    colour: entry && entry.colour ? getSafeColour(entry.colour) : "",
    created_at: String(entry && entry.created_at ? entry.created_at : ""),
  };
}

function getPrimaryJournalEntry(entries) {
  const journals = (entries || []).filter((entry) => entry.type === "journal");
  if (journals.length === 0) {
    return null;
  }

  return journals
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
}

function appendEntryToState(entry) {
  const normalised = normaliseEntry(entry);
  const existing = state.entriesByDate.get(normalised.date) || [];

  const withoutSameId = normalised.id
    ? existing.filter((item) => item.id !== normalised.id)
    : existing.slice();

  const withoutDuplicateColour =
    normalised.type === "colour" && normalised.colour
      ? withoutSameId.filter((item) => {
          return !(
            item.type === "colour"
            && getSafeColour(item.colour) === getSafeColour(normalised.colour)
          );
        })
      : withoutSameId;

  const withoutDuplicateJournal =
    normalised.type === "journal"
      ? withoutDuplicateColour.filter((item) => item.type !== "journal")
      : withoutDuplicateColour;

  state.entriesByDate.set(normalised.date, [...withoutDuplicateJournal, normalised]);
  updateIndicatorForDate(normalised.date);
  return normalised;
}

function removeEntryFromState(entryId, date) {
  const existing = state.entriesByDate.get(date) || [];
  const nextEntries = existing.filter((entry) => entry.id !== entryId);
  state.entriesByDate.set(date, nextEntries);
  updateIndicatorForDate(date);
}

function showDialog(dialogEl) {
  if (!dialogEl) {
    return;
  }

  if (typeof dialogEl.showModal === "function") {
    dialogEl.style.display = "";
    if (!dialogEl.open) {
      dialogEl.showModal();
    }
    return;
  }

  dialogEl.setAttribute("open", "open");
  dialogEl.style.display = "block";
}

function hideDialog(dialogEl) {
  if (!dialogEl) {
    return;
  }

  const hasNativeDialogApi = typeof dialogEl.showModal === "function" && typeof dialogEl.close === "function";
  if (hasNativeDialogApi) {
    if (dialogEl.open) {
      dialogEl.close();
    }
    dialogEl.style.display = "";
    return;
  }

  dialogEl.removeAttribute("open");
  dialogEl.style.display = "none";
}

function openExclusiveDialog(targetDialog) {
  const dialogs = [els.dateDialog, els.legendDialog];
  dialogs.forEach((dialogEl) => {
    if (dialogEl && dialogEl !== targetDialog) {
      hideDialog(dialogEl);
    }
  });
  showDialog(targetDialog);
}

function setPanelLoading(isLoading, date) {
  state.panelLoading = isLoading;
  if (isLoading) {
    els.panelDateLabel.textContent = `Loading ${date}...`;
  }
}

function summariseEntries(entries) {
  const colours = entries
    .filter((entry) => entry.type === "colour" && entry.colour)
    .map((entry) => normaliseHex(entry.colour))
    .filter((colour) => isValidHexColour(colour));

  return {
    colours: [...new Set(colours)],
    taskCount: entries.filter((entry) => entry.type === "task").length,
    hasJournal: entries.some((entry) => entry.type === "journal"),
  };
}

function updateIndicatorForDate(date) {
  const entries = state.entriesByDate.get(date) || [];
  state.indicatorsByDate.set(date, summariseEntries(entries));
}

async function preloadVisibleEntries({ force = false } = {}) {
  const gridDays = buildMonthGrid(state.monthAnchor);
  if (!gridDays.length) {
    return;
  }

  const startDate = gridDays[0].isoDate;
  const endDate = gridDays[gridDays.length - 1].isoDate;
  if (!force) {
    const hasAll = gridDays.every((day) => state.entriesByDate.has(day.isoDate));
    if (hasAll) {
      return;
    }
  }

  const response = await getEntriesInRange(startDate, endDate);
  const rows = response.data || [];
  const grouped = new Map();

  rows.forEach((entry) => {
    const date = String(entry.date || "");
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date).push(normaliseEntry(entry));
  });

  gridDays.forEach((day) => {
    const entries = grouped.get(day.isoDate) || [];
    state.entriesByDate.set(day.isoDate, entries);
    updateIndicatorForDate(day.isoDate);
  });
}

function rerenderCalendar() {
  renderMonthGrid({
    anchorDate: state.monthAnchor,
    gridElement: els.grid,
    monthLabelElement: els.monthLabel,
    indicatorsByDate: state.indicatorsByDate,
  });
}

function refreshCalendarDate(date) {
  const cell = els.grid.querySelector(`[data-date="${date}"]`);
  if (!cell) {
    rerenderCalendar();
    return;
  }

  const indicators = state.indicatorsByDate.get(date) || {
    colours: [],
    taskCount: 0,
    hasJournal: false,
  };
  applyIndicatorsToCell(cell, indicators);
}

function renderEntryList(container, entries, makeText) {
  container.innerHTML = "";
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "entry-item";

    const textContainer = document.createElement("div");
    textContainer.className = "entry-view-row";

    const text = document.createElement("span");
    text.className = "entry-text";
    text.textContent = makeText(entry);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "entry-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-ghost entry-edit-btn";
    editBtn.title = "Edit";
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001"/></svg>';
    editBtn.addEventListener("click", () => {
      openEditEntryDialog(entry);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost";
    removeBtn.textContent = "Delete";
    removeBtn.addEventListener("click", async () => {
      await deleteEntry(entry.id);
      removeEntryFromState(entry.id, state.selectedDate);
      renderDatePanel(state.selectedDate);
      rerenderCalendar();
    });

    textContainer.append(text);
    actionsDiv.append(editBtn, removeBtn);
    li.append(textContainer, actionsDiv);
    container.appendChild(li);
  });
}

function renderColours(entries) {
  els.colourChipList.innerHTML = "";
  entries.forEach((entry) => {
    const holder = document.createElement("div");
    holder.className = "entry-item";

    const left = document.createElement("div");
    left.className = "legend-item-main";

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.backgroundColor = getSafeColour(entry.colour);

    const label = state.legend.find(
      (item) => normaliseHex(item.colour) === normaliseHex(entry.colour)
    )?.label;

    const text = document.createElement("span");
    text.textContent = label ? `${entry.colour} (${label})` : entry.colour;

    left.append(chip, text);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost";
    removeBtn.textContent = "Delete";
    removeBtn.addEventListener("click", async () => {
      await deleteEntry(entry.id);
      removeEntryFromState(entry.id, state.selectedDate);
      renderDatePanel(state.selectedDate);
      rerenderCalendar();
    });

    holder.append(left, removeBtn);
    els.colourChipList.appendChild(holder);
  });
}

function renderDatePanel(date) {
  const entries = state.entriesByDate.get(date) || [];
  const tasks = entries.filter((entry) => entry.type === "task");
  const journalEntry = getPrimaryJournalEntry(entries);
  const journals = journalEntry ? [journalEntry] : [];
  const colours = entries.filter((entry) => entry.type === "colour");

  els.panelDateLabel.textContent = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  renderEntryList(els.taskList, tasks, (entry) => `${entry.title || "Task"}: ${entry.notes || ""}`);
  renderEntryList(els.journalList, journals, (entry) => entry.notes || "(No text)");
  renderColours(colours);

  const journalNotesInput = document.getElementById("journalNotes");
  if (journalNotesInput) {
    journalNotesInput.value = journalEntry ? (journalEntry.notes || "") : "";
    journalNotesInput.dataset.entryId = journalEntry ? (journalEntry.id || "") : "";
  }
  els.addJournalForm.dataset.editing = journalEntry ? "true" : "false";

  showDialog(els.dateDialog);
}

async function loadEntriesForDate(date, { force = false } = {}) {
  if (!force && state.entriesByDate.has(date)) {
    return state.entriesByDate.get(date);
  }

  try {
    const response = await getEntries(date);
    const entries = response.data || [];
    state.entriesByDate.set(date, entries);
    updateIndicatorForDate(date);
    return entries;
  } catch (error) {
    console.warn("Entries API unavailable. Using cached entries only.", error.message);
    if (!state.entriesByDate.has(date)) {
      state.entriesByDate.set(date, []);
      updateIndicatorForDate(date);
    }
    return state.entriesByDate.get(date);
  }
}

function repaintQuickColourOptions() {
  const validLegendItems = state.legend.filter((item) => isValidHexColour(normaliseHex(item.colour)));
  const items = validLegendItems.length > 0
    ? validLegendItems
    : [{ colour: DEFAULT_COLOUR, label: "Default" }];

  els.quickColour.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = getSafeColour(item.colour);
    option.textContent = `${item.label} (${item.colour})`;
    els.quickColour.appendChild(option);
  });

  if (!items.some((item) => getSafeColour(item.colour) === state.selectedColour)) {
    state.selectedColour = getSafeColour(items[0].colour);
  }

  els.quickColour.value = state.selectedColour;
}

function renderLegendDialog() {
  els.legendList.innerHTML = "";
  state.legend.forEach((item) => {
    const li = document.createElement("li");
    li.className = "legend-item";

    const left = document.createElement("div");
    left.className = "legend-item-main";

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.backgroundColor = getSafeColour(item.colour);

    const text = document.createElement("span");
    text.textContent = `${item.label} (${item.colour})`;
    left.append(chip, text);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-ghost";
    removeBtn.textContent = "Delete";
    removeBtn.addEventListener("click", async () => {
      await deleteLegend(item.colour);
      await loadLegend({ force: true });
    });

    li.append(left, removeBtn);
    els.legendList.appendChild(li);
  });
}

async function loadLegend({ force = false } = {}) {
  if (!force && state.legend.length > 0) {
    return state.legend;
  }

  try {
    setDebugStatus("Fetching legend from API...");
    const response = await getLegend();
    setDebugStatus("Legend API response received");
    state.legend = (response.data || []).map(coerceLegendItem);
    setDebugStatus("Legend items processed: " + state.legend.length);
  } catch (error) {
    setDebugStatus("Legend API failed, using defaults: " + error.message);
    console.warn("Legend API unavailable. Falling back to local defaults.", error.message);
    if (state.legend.length === 0) {
      state.legend = [
        { colour: "#e75480", label: "Focus" },
        { colour: "#2e7d32", label: "Complete" },
      ];
    }
  }

  setDebugStatus("Rendering legend UI...");
  repaintQuickColourOptions();
  renderLegendDialog();
  setDebugStatus("Legend loaded ✓");
  return state.legend;
}

async function openDatePanel(date) {
  const requestId = state.panelRequestId + 1;
  state.panelRequestId = requestId;
  state.selectedDate = date;

  openExclusiveDialog(els.dateDialog);
  setPanelLoading(true, date);

  await loadEntriesForDate(date);
  if (requestId !== state.panelRequestId) {
    return;
  }

  setPanelLoading(false, date);
  renderDatePanel(date);
  rerenderCalendar();

  const active = els.grid.querySelector(`[data-date="${date}"]`);
  if (active) {
    active.classList.add("active");
  }
}

async function addEntry(type, payload) {
  const response = await createEntry({
    type,
    date: state.selectedDate,
    ...payload,
  });

  appendEntryToState(response.data || {
    type,
    date: state.selectedDate,
    ...payload,
  });
  renderDatePanel(state.selectedDate);
  refreshCalendarDate(state.selectedDate);
}

function setupDragHighlighting() {
  els.grid.addEventListener("pointerdown", (event) => {
    console.log("[EthanPlanner] Pointer down");
    const cell = event.target.closest(".calendar-cell");
    if (!cell) {
      console.log("[EthanPlanner] Pointer down but no cell found");
      return;
    }

    console.log("[EthanPlanner] Drag start on", cell.dataset.date);
  state.pointerDate = cell.dataset.date;
    state.dragActive = true;
    state.dragMoved = false;
    state.dragTouchedDates = new Set();

    if (typeof els.grid.setPointerCapture === "function") {
      try {
        els.grid.setPointerCapture(event.pointerId);
      } catch (captureError) {
        console.debug("Pointer capture unavailable", captureError);
      }
    }
  });

  els.grid.addEventListener("pointermove", (event) => {
    if (!state.dragActive) {
      return;
    }

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const cell = hit?.closest?.(".calendar-cell");
    if (!cell) {
      return;
    }

    const date = cell.dataset.date;
    if (!date || state.dragTouchedDates.has(date)) {
      return;
    }

    state.dragMoved = true;
    state.dragTouchedDates.add(date);
    const pendingId = `pending-${date}-${Date.now()}-${state.dragTouchedDates.size}`;
    appendEntryToState({
      id: pendingId,
      type: "colour",
      date,
      colour: getSafeColour(state.selectedColour),
      created_at: "",
    });
    refreshCalendarDate(date);

    state.dragQueue = state.dragQueue
      .then(async () => {
        const response = await createEntry({
          type: "colour",
          date,
          colour: getSafeColour(state.selectedColour),
        });
        removeEntryFromState(pendingId, date);
        appendEntryToState(response.data || {
          type: "colour",
          date,
          colour: getSafeColour(state.selectedColour),
        });
      })
      .then(() => {
        refreshCalendarDate(date);
      })
      .catch((error) => {
        console.error("Failed drag highlight", error);
        removeEntryFromState(pendingId, date);
        refreshCalendarDate(date);
      });
  });

  const finish = () => {
    console.log("[EthanPlanner] Drag end. dragMoved:", state.dragMoved);
    const clickedDate = state.pointerDate;

    if (state.dragMoved) {
      state.suppressNextClick = true;
    } else if (clickedDate) {
      state.suppressNextClick = true;
      setDebugStatus("Opening panel: " + clickedDate);
      console.log("[EthanPlanner] Opening date panel from pointerup for", clickedDate);
      void openDatePanel(clickedDate);
    }

    state.dragActive = false;
    state.dragMoved = false;
    state.dragTouchedDates.clear();
    state.pointerDate = null;
  };

  els.grid.addEventListener("pointerup", finish);
  els.grid.addEventListener("pointercancel", finish);
}

function bindEvents() {
  els.prevMonth.addEventListener("click", async () => {
    state.monthAnchor = new Date(state.monthAnchor.getFullYear(), state.monthAnchor.getMonth() - 1, 1);
    try {
      await preloadVisibleEntries({ force: true });
    } catch (error) {
      console.warn("Month preload failed", error.message);
    }
    rerenderCalendar();
  });

  els.nextMonth.addEventListener("click", async () => {
    state.monthAnchor = new Date(state.monthAnchor.getFullYear(), state.monthAnchor.getMonth() + 1, 1);
    try {
      await preloadVisibleEntries({ force: true });
    } catch (error) {
      console.warn("Month preload failed", error.message);
    }
    rerenderCalendar();
  });

  els.quickColour.addEventListener("change", (event) => {
    state.selectedColour = getSafeColour(event.target.value);
  });

  els.grid.addEventListener("click", async (event) => {
    setDebugStatus("Grid click fired");
    console.log("[EthanPlanner] Grid click event fired", { suppressNextClick: state.suppressNextClick, target: event.target.className });
    if (state.suppressNextClick) {
      setDebugStatus("Click suppressed (drag)");
      console.log("[EthanPlanner] Click suppressed (drag aftermath)");
      state.suppressNextClick = false;
      return;
    }

    const cell = event.target.closest(".calendar-cell");
    console.log("[EthanPlanner] Cell found:", cell ? cell.dataset.date : "none");
    if (!cell) {
      const activeCell = document.activeElement?.closest?.(".calendar-cell");
      if (!activeCell) {
        setDebugStatus("Click but not on cell");
        return;
      }

      console.log("[EthanPlanner] Falling back to active cell:", activeCell.dataset.date);
      await openDatePanel(activeCell.dataset.date);
      return;
    }

    if (state.panelLoading && state.selectedDate === cell.dataset.date) {
      setDebugStatus("Panel already loading");
      console.log("[EthanPlanner] Panel already loading for this date");
      return;
    }

    setDebugStatus("Opening panel: " + cell.dataset.date);
    console.log("[EthanPlanner] Opening date panel for", cell.dataset.date);
    await openDatePanel(cell.dataset.date);
  });

  els.closeDateDialog.addEventListener("click", () => hideDialog(els.dateDialog));
  els.legendButton.addEventListener("click", () => openExclusiveDialog(els.legendDialog));
  els.closeLegendDialog.addEventListener("click", () => hideDialog(els.legendDialog));

  els.addTaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = document.getElementById("taskTitle").value.trim();
    const notes = document.getElementById("taskNotes").value.trim();
    if (!title) {
      return;
    }

    if (els.addTaskForm.dataset.editing === "true") {
      const entryId = document.getElementById("taskTitle").dataset.entryId;
      await updateEntry(entryId, { title, notes });
      els.addTaskForm.dataset.editing = "false";
    } else {
      await addEntry("task", { title, notes });
    }
    els.addTaskForm.reset();
  });

  els.addJournalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const journalNotesInput = document.getElementById("journalNotes");
    const notes = journalNotesInput.value.trim();
    if (!notes) {
      return;
    }

    const entryId = journalNotesInput.dataset.entryId;
    if (entryId) {
      const response = await updateEntry(entryId, { notes });
      appendEntryToState(response.data || {
        id: entryId,
        type: "journal",
        date: state.selectedDate,
        notes,
      });
    } else {
      await addEntry("journal", { notes });
    }

    journalNotesInput.value = notes;
    journalNotesInput.dataset.entryId = (getPrimaryJournalEntry(state.entriesByDate.get(state.selectedDate) || []) || {}).id || "";
    els.addJournalForm.dataset.editing = journalNotesInput.dataset.entryId ? "true" : "false";
    renderDatePanel(state.selectedDate);
    refreshCalendarDate(state.selectedDate);
  });

  els.addColourForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const colour = getSafeColour(els.colourInput.value);
    await addEntry("colour", { colour });
  });

  els.legendForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const colour = getSafeColour(els.legendColour.value);
    const label = els.legendLabel.value.trim();
    if (!label) {
      return;
    }

    const labelKey = label.toLowerCase();
    const hasExact = state.legend.some(
      (item) => getSafeColour(item.colour) === colour && String(item.label || "").trim().toLowerCase() === labelKey
    );
    if (hasExact) {
      return;
    }

    await upsertLegend({ colour, label });
    els.legendForm.reset();
    await loadLegend({ force: true });
  });

  setupDragHighlighting();
}

async function initApp() {
  setDebugStatus("Initializing...");
  
  try {
    renderWeekdays(els.weekdayRow);
    setDebugStatus("Weekdays rendered");
    bindEvents();
    setDebugStatus("Events bound");
    
    setDebugStatus("Loading legend (5s timeout)...");
    const legendPromise = loadLegend();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Legend load timeout")), 5000)
    );
    
    try {
      await Promise.race([legendPromise, timeoutPromise]);
    } catch (timeoutError) {
      setDebugStatus("Legend timed out, using fallback");
      state.legend = [
        { colour: "#e75480", label: "Focus" },
        { colour: "#2e7d32", label: "Complete" },
      ];
      repaintQuickColourOptions();
      renderLegendDialog();
    }
    
    setDebugStatus("Loading month entries...");
    try {
      await preloadVisibleEntries({ force: true });
    } catch (preloadError) {
      console.warn("Initial month preload failed", preloadError.message);
    }

    setDebugStatus("Rendering calendar...");
    rerenderCalendar();
    const cellCount = els.grid.querySelectorAll(".calendar-cell").length;
    setDebugStatus("Ready ✓ (" + cellCount + " cells)");
  } catch (err) {
    setDebugStatus("INIT ERROR: " + err.message);
  }
}

initApp();
