const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toMondayIndex(day) {
  return (day + 6) % 7;
}

export function renderWeekdays(container) {
  container.innerHTML = "";
  WEEKDAYS.forEach((weekday) => {
    const el = document.createElement("div");
    el.className = "weekday-cell";
    el.textContent = weekday;
    container.appendChild(el);
  });
}

export function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildMonthGrid(anchorDate) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstGridDay = new Date(firstOfMonth);
  firstGridDay.setDate(firstGridDay.getDate() - toMondayIndex(firstOfMonth.getDay()));

  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(firstGridDay);
    d.setDate(firstGridDay.getDate() + i);
    days.push({
      isoDate: formatISODate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }

  return days;
}

export function renderMonthGrid({
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
    gridElement.appendChild(cell);
  });
}
