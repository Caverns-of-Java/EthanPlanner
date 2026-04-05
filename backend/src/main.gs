function getPath(e) {
  var pathInfo = (e && e.pathInfo ? String(e.pathInfo) : "").replace(/^\/+/, "").toLowerCase();
  if (pathInfo) {
    return pathInfo;
  }

  var route = e && e.parameter && e.parameter.route ? String(e.parameter.route) : "";
  return route.replace(/^\/+/, "").toLowerCase();
}

function doGet(e) {
  try {
    var path = getPath(e);
    if (path === "entries") {
      return handleEntriesGet(e);
    }
    if (path === "legend") {
      return handleLegendGet();
    }
    return fail("Unknown endpoint");
  } catch (err) {
    Logger.log("doGet error: " + err.toString() + " | Stack: " + err.stack);
    return fail("Server error", String(err));
  }
}

function doPost(e) {
  try {
    var path = getPath(e);
    var body = parseJsonBody(e);
    var methodOverride = body && body._method ? String(body._method).toUpperCase() : "POST";

    if (path === "entries" && methodOverride === "POST") {
      return handleEntriesPost(body);
    }
    if (path === "entries" && methodOverride === "DELETE") {
      return handleEntriesDelete(body);
    }
    if (path === "entries" && methodOverride === "PATCH") {
      return handleEntriesPatch(body);
    }
    if (path === "legend" && methodOverride === "POST") {
      return handleLegendPost(body);
    }
    if (path === "legend" && methodOverride === "DELETE") {
      return handleLegendDelete(body);
    }
    

    return fail("Unknown endpoint or method");
  } catch (err) {
    Logger.log("doPost error: " + err.toString() + " | Stack: " + err.stack);
    return fail("Server error", String(err));
  }
}
