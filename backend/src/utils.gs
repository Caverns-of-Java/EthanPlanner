function jsonResponse(payload, statusCode) {
  var response = ContentService.createTextOutput(JSON.stringify(payload));
  response.setMimeType(ContentService.MimeType.JSON);
  return response;
}

function ok(data) {
  return jsonResponse({ ok: true, data: data }, 200);
}

function fail(message, details) {
  return jsonResponse({ ok: false, error: message, details: details || null }, 400);
}

function getSheet(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) {
    throw new Error("Missing sheet: " + name);
  }
  return sheet;
}

function readRowsAsObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = values[0];
  var rows = values.slice(1);
  return rows.map(function(row, index) {
    var item = { __rowIndex: index + 2 };
    headers.forEach(function(header, hIndex) {
      item[header] = row[hIndex];
    });
    return item;
  });
}

function normaliseHeaderKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getRowField(row, logicalKey) {
  if (!row) {
    return "";
  }

  if (row.hasOwnProperty(logicalKey)) {
    return row[logicalKey];
  }

  var target = normaliseHeaderKey(logicalKey);
  var key;
  for (key in row) {
    if (row.hasOwnProperty(key) && key !== "__rowIndex" && normaliseHeaderKey(key) === target) {
      return row[key];
    }
  }

  return "";
}

function toIsoDateValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
  }

  var text = String(value).trim();
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, "UTC", "yyyy-MM-dd");
  }

  return text;
}

function normaliseEntryType(value) {
  return String(value || "").trim().toLowerCase();
}

function appendRowFromObject(sheetName, rowObject) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(header) {
    var direct = rowObject[header];
    if (direct !== undefined && direct !== null && direct !== "") {
      return direct;
    }

    var key = normaliseHeaderKey(header);
    var lookup = {
      id: "id",
      date: "date",
      type: "type",
      title: "title",
      notes: "notes",
      colour: "colour",
      color: "colour",
      createdat: "created_at",
      created_at: "created_at",
      createdon: "created_at",
      label: "label"
    };

    var mapped = lookup[key];
    if (mapped && rowObject[mapped] !== undefined && rowObject[mapped] !== null) {
      return rowObject[mapped];
    }

    return "";
  });
  sheet.appendRow(row);
}

function deleteRowWhere(sheetName, predicate) {
  var rows = readRowsAsObjects(sheetName);
  for (var i = rows.length - 1; i >= 0; i -= 1) {
    if (predicate(rows[i])) {
      getSheet(sheetName).deleteRow(rows[i].__rowIndex);
      return true;
    }
  }
  return false;
}

function parseJsonBody(e) {
  if (!e) {
    return {};
  }

  var queryParams = e.parameter || {};
  var postContents = e.postData && e.postData.contents ? String(e.postData.contents) : "";
  if (!postContents) {
    return queryParams;
  }

  var contentType = e.postData && e.postData.type ? String(e.postData.type).toLowerCase() : "";

  if (contentType.indexOf("application/x-www-form-urlencoded") >= 0) {
    var parsedForm = parseFormEncoded(postContents);
    return mergeObjects(queryParams, parsedForm);
  }

  try {
    var parsedJson = JSON.parse(postContents);
    return mergeObjects(queryParams, parsedJson);
  } catch (err) {
    return queryParams;
  }
}

function parseFormEncoded(text) {
  if (!text) {
    return {};
  }

  return text.split("&").reduce(function(acc, pair) {
    if (!pair) {
      return acc;
    }

    var tokens = pair.split("=");
    var rawKey = tokens.shift() || "";
    var rawValue = tokens.join("=");
    var key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    var value = decodeURIComponent((rawValue || "").replace(/\+/g, " "));
    acc[key] = value;
    return acc;
  }, {});
}

function mergeObjects(baseObj, overrideObj) {
  var result = {};
  var key;

  baseObj = baseObj || {};
  overrideObj = overrideObj || {};

  for (key in baseObj) {
    if (baseObj.hasOwnProperty(key)) {
      result[key] = baseObj[key];
    }
  }

  for (key in overrideObj) {
    if (overrideObj.hasOwnProperty(key)) {
      result[key] = overrideObj[key];
    }
  }

  return result;
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidHexColour(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normaliseHexColour(value) {
  var text = value ? String(value).trim().toLowerCase() : "";
  if (!text) {
    return "";
  }

  if (text.charAt(0) !== "#") {
    text = "#" + text;
  }

  return text;
}

function uuid() {
  return Utilities.getUuid();
}

function setRowField(row, logicalKey, value) {
  if (!row) {
    return;
  }

  // Try to find the key in the row
  if (row.hasOwnProperty(logicalKey)) {
    row[logicalKey] = value;
    return;
  }

  // Try to find the key by normalised header match
  var target = normaliseHeaderKey(logicalKey);
  var key;
  for (key in row) {
    if (row.hasOwnProperty(key) && key !== "__rowIndex" && normaliseHeaderKey(key) === target) {
      row[key] = value;
      return;
    }
  }
}

function updateRowInSheet(sheetName, row) {
  if (!row || !row.__rowIndex) {
    throw new Error("Row must have __rowIndex property");
  }

  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = headers.map(function(header) {
    return getRowField(row, header);
  });

  sheet.getRange(row.__rowIndex, 1, 1, values.length).setValues([values]);
}
