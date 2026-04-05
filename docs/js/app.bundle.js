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
  const url = buildUrl(path, query);
  const options = { method };

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
    throw new Error(json.error || `Request failed: ${res.status}`);
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

function buildSplitColourBackground(colours, alpha = 0.18) {
  if (!Array.isArray(colours) || colours.length === 0) {
    return "";
  }

  const width = 100 / colours.length;
  const segments = colours.map((colour, index) => {
    const start = (index * width).toFixed(4);
    const end = ((index + 1) * width).toFixed(4);
    return `${hexToRgba(colour, alpha)} ${start}% ${end}%`;
  });

  return `linear-gradient(to bottom, ${segments.join(", ")})`;
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

    const indicatorColours = Array.isArray(dateIndicators.colours)
      ? dateIndicators.colours
          .map((colour) => normaliseHex(colour))
          .filter((colour) => isValidHexColour(colour))
      : [];
    const primaryColour = indicatorColours.length > 0
      ? indicatorColours[indicatorColours.length - 1]
      : "";

    if (indicatorColours.length > 0) {
      cell.classList.add("has-colour-fill");
      cell.style.backgroundImage = buildSplitColourBackground(indicatorColours, 0.18);
      cell.style.backgroundColor = "";
      cell.style.borderColor = hexToRgba(primaryColour, 0.45);
    } else {
      cell.classList.remove("has-colour-fill");
      cell.style.backgroundImage = "";
      cell.style.backgroundColor = "";
      cell.style.borderColor = "";
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

    const taskPreview = document.createElement("div");
    taskPreview.className = "cell-tasks";
    (dateIndicators.taskTitles || []).forEach((title) => {
      const t = document.createElement("div");
      t.className = "cell-task-item";
      t.textContent = title;
      taskPreview.appendChild(t);
    });

    const meta = document.createElement("div");
    meta.className = "cell-meta";
    if (dateIndicators.hasJournal) {
      meta.textContent = "Journal";
    }

    cell.append(number, chips, taskPreview, meta);
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
  highlightMode: "edit",
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
  modeEdit: document.getElementById("modeEdit"),
  modeHighlight: document.getElementById("modeHighlight"),
  modeErase: document.getElementById("modeErase"),
  dateDialog: document.getElementById("dateDialog"),
  panelDateLabel: document.getElementById("panelDateLabel"),
  closeDateDialog: document.getElementById("closeDateDialog"),
  taskList: document.getElementById("taskList"),
  journalList: document.getElementById("journalList"),
  addTaskForm: document.getElementById("addTaskForm"),
  addJournalForm: document.getElementById("addJournalForm"),
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

function getIndicatorColours(dateIndicators) {
  if (!dateIndicators || !Array.isArray(dateIndicators.colours)) {
    return [];
  }

  return dateIndicators.colours
    .map((colour) => normaliseHex(colour))
    .filter((colour) => isValidHexColour(colour));
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
    taskTitles: [],
    hasJournal: false,
  };
  const indicatorColours = getIndicatorColours(safeIndicators);
  const primaryColour = indicatorColours.length > 0
    ? indicatorColours[indicatorColours.length - 1]
    : "";

  const taskPreview = cell.querySelector(".cell-tasks");
  if (taskPreview) {
    taskPreview.innerHTML = "";
    (safeIndicators.taskTitles || []).forEach((title) => {
      const t = document.createElement("div");
      t.className = "cell-task-item";
      t.textContent = title;
      taskPreview.appendChild(t);
    });
  }

  const meta = cell.querySelector(".cell-meta");
  if (meta) {
    meta.textContent = safeIndicators.hasJournal ? "Journal" : "";
  }

  if (indicatorColours.length > 0) {
    cell.classList.add("has-colour-fill");
    cell.style.backgroundImage = buildSplitColourBackground(indicatorColours, 0.18);
    cell.style.backgroundColor = "";
    cell.style.borderColor = hexToRgba(primaryColour, 0.42);
  } else {
    cell.classList.remove("has-colour-fill");
    cell.style.backgroundImage = "";
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

  state.entriesByDate.set(normalised.date, [...withoutDuplicateColour, normalised]);
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
    taskTitles: entries
      .filter((entry) => entry.type === "task" && entry.title)
      .map((entry) => String(entry.title)),
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

function renderEntryList(container, entries, fields) {
  container.innerHTML = "";
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "entry-item entry-item--view";

    // ── View row ───────────────────────────────────────────
    const viewRow = document.createElement("div");
    viewRow.className = "entry-view-row";

    const text = document.createElement("span");
    text.className = "entry-text";
    text.textContent = fields.display(entry);

    const actions = document.createElement("div");
    actions.className = "entry-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-ghost";
    editBtn.textContent = "Edit";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost";
    deleteBtn.textContent = "Delete";

    actions.append(editBtn, deleteBtn);
    viewRow.append(text, actions);

    // ── Edit form ──────────────────────────────────────────
    const editForm = document.createElement("form");
    editForm.className = "entry-edit-form";
    editForm.style.display = "none";

    const editInputs = {};
    fields.editFields.forEach(({ key, label, multiline }) => {
      const fieldWrap = document.createElement("div");
      fieldWrap.className = "entry-edit-field";

      const lbl = document.createElement("label");
      lbl.textContent = label;

      const input = multiline
        ? document.createElement("textarea")
        : document.createElement("input");
      if (!multiline) {
        input.type = "text";
      }
      input.value = entry[key] || "";
      input.className = "entry-edit-input";
      if (multiline) {
        input.rows = 3;
      }

      editInputs[key] = input;
      fieldWrap.append(lbl, input);
      editForm.appendChild(fieldWrap);
    });

    const formActions = document.createElement("div");
    formActions.className = "entry-edit-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = "Cancel";

    formActions.append(saveBtn, cancelBtn);
    editForm.appendChild(formActions);

    // ── Interaction ────────────────────────────────────────
    const showView = () => {
      li.classList.replace("entry-item--edit", "entry-item--view");
      viewRow.style.display = "";
      editForm.style.display = "none";
    };

    const showEdit = () => {
      fields.editFields.forEach(({ key }) => {
        editInputs[key].value = entry[key] || "";
      });
      li.classList.replace("entry-item--view", "entry-item--edit");
      viewRow.style.display = "none";
      editForm.style.display = "";
      editInputs[fields.editFields[0].key].focus();
    };

    editBtn.addEventListener("click", showEdit);
    cancelBtn.addEventListener("click", showView);

    deleteBtn.addEventListener("click", async () => {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "...";
      await deleteEntry(entry.id);
      removeEntryFromState(entry.id, state.selectedDate);
      renderDatePanel(state.selectedDate);
      rerenderCalendar();
    });

    editForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const payload = {};
      fields.editFields.forEach(({ key }) => {
        payload[key] = editInputs[key].value.trim();
      });
      const response = await updateEntry(entry.id, payload);
      const updated = response.data || { ...entry, ...payload };
      Object.assign(entry, updated);
      text.textContent = fields.display(entry);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      // also refresh tile task preview if this was a task
      updateIndicatorForDate(state.selectedDate);
      refreshCalendarDate(state.selectedDate);
      showView();
    });

    li.append(viewRow, editForm);
    container.appendChild(li);
  });
}

function renderDatePanel(date) {
  const entries = state.entriesByDate.get(date) || [];
  const tasks = entries.filter((entry) => entry.type === "task");
  const journals = entries.filter((entry) => entry.type === "journal");

  els.panelDateLabel.textContent = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  renderEntryList(els.taskList, tasks, {
    display: (entry) => `${entry.title || "Task"}${entry.notes ? ": " + entry.notes : ""}`,
    editFields: [
      { key: "title", label: "Title", multiline: false },
      { key: "notes", label: "Details", multiline: true },
    ],
  });
  renderEntryList(els.journalList, journals, {
    display: (entry) => entry.notes || "(No text)",
    editFields: [
      { key: "notes", label: "Notes", multiline: true },
    ],
  });
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
    option.textContent = item.label || item.colour;
    option.style.backgroundColor = hexToRgba(option.value, 0.18);
    option.style.color = "#1f2937";
    els.quickColour.appendChild(option);
  });

  if (!items.some((item) => getSafeColour(item.colour) === state.selectedColour)) {
    state.selectedColour = getSafeColour(items[0].colour);
  }

  els.quickColour.value = state.selectedColour;
  paintQuickColourControl();
}

function paintQuickColourControl() {
  const selected = getSafeColour(state.selectedColour);
  els.quickColour.style.backgroundColor = hexToRgba(selected, 0.18);
  els.quickColour.style.borderColor = hexToRgba(selected, 0.45);
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

function setHighlightMode(mode) {
  state.highlightMode = ["edit", "paint", "erase"].includes(mode) ? mode : "edit";

  const toolbar = document.getElementById("highlightToolbar");
  if (toolbar) {
    toolbar.dataset.mode = state.highlightMode;
  }

  [
    { el: els.modeEdit, key: "edit" },
    { el: els.modeHighlight, key: "paint" },
    { el: els.modeErase, key: "erase" },
  ].forEach(({ el, key }) => {
    if (!el) {
      return;
    }

    const active = state.highlightMode === key;
    el.setAttribute("aria-pressed", String(active));
    el.classList.toggle("is-active", active);
  });
}

async function eraseColourEntriesForDate(date, colour = state.selectedColour) {
  const entries = state.entriesByDate.get(date) || [];
  const targetColour = getSafeColour(colour);
  const removable = entries.filter(
    (entry) => entry.type === "colour" && getSafeColour(entry.colour) === targetColour
  );
  if (removable.length === 0) {
    return;
  }

  state.entriesByDate.set(
    date,
    entries.filter(
      (entry) => entry.type !== "colour" || getSafeColour(entry.colour) !== targetColour
    )
  );
  updateIndicatorForDate(date);
  refreshCalendarDate(date);
  if (state.selectedDate === date && (els.dateDialog?.open || els.dateDialog?.hasAttribute("open"))) {
    renderDatePanel(date);
  }

  try {
    await Promise.all(
      removable
        .filter((entry) => entry.id && !String(entry.id).startsWith("pending-"))
        .map((entry) => deleteEntry(entry.id))
    );
  } catch (error) {
    console.error("Failed erasing highlights", error);
    await loadEntriesForDate(date, { force: true });
    refreshCalendarDate(date);
  }
}

function queueHighlightAction(date) {
  if (!date) {
    return;
  }

  if (state.highlightMode === "edit") {
    return;
  }

  if (state.highlightMode === "erase") {
    const targetColour = getSafeColour(state.selectedColour);
    const entries = state.entriesByDate.get(date) || [];
    const removable = entries.filter(
      (entry) => entry.type === "colour" && getSafeColour(entry.colour) === targetColour
    );
    if (removable.length === 0) {
      return;
    }

    // Optimistic update immediately (same pattern as paint mode)
    state.entriesByDate.set(
      date,
      entries.filter(
        (entry) => entry.type !== "colour" || getSafeColour(entry.colour) !== targetColour
      )
    );
    updateIndicatorForDate(date);
    refreshCalendarDate(date);

    // Only defer the API deletes
    state.dragQueue = state.dragQueue
      .then(() => Promise.all(
        removable
          .filter((entry) => entry.id && !String(entry.id).startsWith("pending-"))
          .map((entry) => deleteEntry(entry.id))
      ))
      .catch(async (error) => {
        console.error("Failed drag erase", error);
        await loadEntriesForDate(date, { force: true });
        refreshCalendarDate(date);
      });
    return;
  }

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
    queueHighlightAction(date);
  });

  const finish = () => {
    console.log("[EthanPlanner] Drag end. dragMoved:", state.dragMoved);
    const clickedDate = state.pointerDate;

    if (state.dragMoved) {
      state.suppressNextClick = true;
    } else if (clickedDate) {
      state.suppressNextClick = true;
      if (state.highlightMode === "erase") {
        void eraseColourEntriesForDate(clickedDate);
      } else if (state.highlightMode === "paint") {
        queueHighlightAction(clickedDate);
      } else {
        setDebugStatus("Opening panel: " + clickedDate);
        console.log("[EthanPlanner] Opening date panel from pointerup for", clickedDate);
        void openDatePanel(clickedDate);
      }
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
    paintQuickColourControl();
  });

  els.modeEdit?.addEventListener("click", () => setHighlightMode("edit"));
  els.modeHighlight?.addEventListener("click", () => setHighlightMode("paint"));
  els.modeErase?.addEventListener("click", () => setHighlightMode("erase"));

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

    await addEntry("task", { title, notes });
    els.addTaskForm.reset();
  });

  els.addJournalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const notes = document.getElementById("journalNotes").value.trim();
    if (!notes) {
      return;
    }

    await addEntry("journal", { notes });
    els.addJournalForm.reset();
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
      setHighlightMode("edit");
    } catch (timeoutError) {
      setDebugStatus("Legend timed out, using fallback");
      state.legend = [
        { colour: "#e75480", label: "Focus" },
        { colour: "#2e7d32", label: "Complete" },
      ];
      repaintQuickColourOptions();
      renderLegendDialog();
      setHighlightMode("edit");
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
