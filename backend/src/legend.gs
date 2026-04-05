function handleLegendGet() {
  var rows = readRowsAsObjects("Legend").map(function(row) {
    return {
      colour: String(row.colour).toLowerCase(),
      label: String(row.label || "")
    };
  });
  return ok(rows);
}

function handleLegendPost(body) {
  var colour = normaliseHexColour(body && body.colour);
  var label = body && body.label ? String(body.label).trim() : "";

  if (!isValidHexColour(colour)) {
    return fail("Invalid colour format. Expected #RRGGBB");
  }
  if (!label) {
    return fail("Label is required");
  }

  var rows = readRowsAsObjects("Legend");
  var colourMatch = rows.find(function(row) {
    return normaliseHexColour(row.colour) === colour;
  });

  var exactMatch = rows.find(function(row) {
    return normaliseHexColour(row.colour) === colour && String(row.label || "").trim().toLowerCase() === label.toLowerCase();
  });

  if (exactMatch) {
    return ok({ colour: colour, label: label, unchanged: true });
  }

  var labelMatch = rows.find(function(row) {
    return String(row.label || "").trim().toLowerCase() === label.toLowerCase();
  });

  if (colourMatch) {
    getSheet("Legend").getRange(colourMatch.__rowIndex, 2).setValue(label);
  } else if (labelMatch) {
    getSheet("Legend").getRange(labelMatch.__rowIndex, 1).setValue(colour);
    getSheet("Legend").getRange(labelMatch.__rowIndex, 2).setValue(label);
  } else {
    appendRowFromObject("Legend", { colour: colour, label: label });
  }

  return ok({ colour: colour, label: label });
}

function handleLegendDelete(payload) {
  var colour = normaliseHexColour(payload && payload.colour);
  if (!isValidHexColour(colour)) {
    return fail("Invalid colour format. Expected #RRGGBB");
  }

  var removed = deleteRowWhere("Legend", function(row) {
    return String(row.colour).toLowerCase() === colour;
  });

  if (!removed) {
    return fail("Legend colour not found");
  }

  return ok({ deleted: true, colour: colour });
}
