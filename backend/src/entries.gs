function handleEntriesGet(e) {
  var date = e && e.parameter ? e.parameter.date : "";
  var startDate = e && e.parameter ? e.parameter.start_date : "";
  var endDate = e && e.parameter ? e.parameter.end_date : "";

  if (date) {
    if (!isValidIsoDate(date)) {
      return fail("Invalid date. Expected YYYY-MM-DD");
    }

    var exactRows = readRowsAsObjects("CalendarEntries")
      .filter(function(row) {
        return toIsoDateValue(getRowField(row, "date")) === date;
      })
      .map(function(row) {
        return {
          id: String(getRowField(row, "id")),
          date: toIsoDateValue(getRowField(row, "date")),
          type: normaliseEntryType(getRowField(row, "type")),
          title: String(getRowField(row, "title") || ""),
          notes: String(getRowField(row, "notes") || ""),
          colour: normaliseHexColour(getRowField(row, "colour")),
          created_at: String(getRowField(row, "created_at") || "")
        };
      });

    return ok(exactRows);
  }

  if (startDate || endDate) {
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return fail("Invalid range. Expected start_date/end_date as YYYY-MM-DD");
    }
    if (startDate > endDate) {
      return fail("Invalid range. start_date must be <= end_date");
    }

    var rangedRows = readRowsAsObjects("CalendarEntries")
      .filter(function(row) {
        var rowDate = toIsoDateValue(getRowField(row, "date"));
        return rowDate >= startDate && rowDate <= endDate;
      })
      .map(function(row) {
        return {
          id: String(getRowField(row, "id")),
          date: toIsoDateValue(getRowField(row, "date")),
          type: normaliseEntryType(getRowField(row, "type")),
          title: String(getRowField(row, "title") || ""),
          notes: String(getRowField(row, "notes") || ""),
          colour: normaliseHexColour(getRowField(row, "colour")),
          created_at: String(getRowField(row, "created_at") || "")
        };
      });

    return ok(rangedRows);
  }

  return fail("Missing date or range. Provide date or start_date/end_date");
}

function handleEntriesPost(body) {
  if (!body.type) {
    return fail("Missing type");
  }
  if (!isValidIsoDate(body.date)) {
    return fail("Invalid date. Expected YYYY-MM-DD");
  }

  var type = String(body.type);
  if (["task", "journal", "colour"].indexOf(type) === -1) {
    return fail("Unsupported type");
  }

  var colour = normaliseHexColour(body.colour);
  if (type === "colour" && !isValidHexColour(colour)) {
    return fail("Invalid colour format. Expected #RRGGBB");
  }

  if (type === "colour") {
    var existingColour = readRowsAsObjects("CalendarEntries").find(function(row) {
      return toIsoDateValue(getRowField(row, "date")) === body.date
        && normaliseEntryType(getRowField(row, "type")) === "colour"
        && normaliseHexColour(getRowField(row, "colour")) === colour;
    });

    if (existingColour) {
      return ok({
        id: String(getRowField(existingColour, "id")),
        date: toIsoDateValue(getRowField(existingColour, "date")),
        type: "colour",
        title: String(getRowField(existingColour, "title") || ""),
        notes: String(getRowField(existingColour, "notes") || ""),
        colour: normaliseHexColour(getRowField(existingColour, "colour")),
        created_at: String(getRowField(existingColour, "created_at") || ""),
        unchanged: true
      });
    }
  }

  if (type === "journal") {
    var existingJournal = readRowsAsObjects("CalendarEntries").find(function(row) {
      return toIsoDateValue(getRowField(row, "date")) === body.date
        && normaliseEntryType(getRowField(row, "type")) === "journal";
    });

    if (existingJournal) {
      setRowField(existingJournal, "notes", body.notes ? String(body.notes) : "");
      setRowField(existingJournal, "title", body.title ? String(body.title) : "");
      updateRowInSheet("CalendarEntries", existingJournal);

      return ok({
        id: String(getRowField(existingJournal, "id")),
        date: toIsoDateValue(getRowField(existingJournal, "date")),
        type: "journal",
        title: String(getRowField(existingJournal, "title") || ""),
        notes: String(getRowField(existingJournal, "notes") || ""),
        colour: normaliseHexColour(getRowField(existingJournal, "colour")),
        created_at: String(getRowField(existingJournal, "created_at") || ""),
        updated: true
      });
    }
  }

  var record = {
    id: uuid(),
    date: body.date,
    type: type,
    title: body.title ? String(body.title) : "",
    notes: body.notes ? String(body.notes) : "",
    colour: colour,
    created_at: new Date().toISOString()
  };

  appendRowFromObject("CalendarEntries", record);
  return ok(record);
}

function handleEntriesDelete(payload) {
  var id = payload && payload.id ? String(payload.id) : "";
  if (!id) {
    return fail("Missing id");
  }

  var removed = deleteRowWhere("CalendarEntries", function(row) {
    return String(getRowField(row, "id")) === id;
  });

  if (!removed) {
    return fail("Entry not found");
  }

  return ok({ deleted: true, id: id });
}
function handleEntriesPatch(body) {
  var id = body && body.id ? String(body.id) : "";
  if (!id) {
    return fail("Missing id");
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CalendarEntries");
  var rows = readRowsAsObjects("CalendarEntries");
  var target = rows.find(function(row) {
    return String(getRowField(row, "id")) === id;
  });

  if (!target) {
    return fail("Entry not found");
  }

  // Only allow patching title and notes — never type, date, colour, id
  if (body.title !== undefined) {
    setRowField(target, "title", String(body.title));
  }
  if (body.notes !== undefined) {
    setRowField(target, "notes", String(body.notes));
  }

  updateRowInSheet("CalendarEntries", target);

  return ok({
    id: id,
    date: toIsoDateValue(getRowField(target, "date")),
    type: normaliseEntryType(getRowField(target, "type")),
    title: String(getRowField(target, "title") || ""),
    notes: String(getRowField(target, "notes") || ""),
    colour: normaliseHexColour(getRowField(target, "colour")),
    created_at: String(getRowField(target, "created_at") || "")
  });
}
