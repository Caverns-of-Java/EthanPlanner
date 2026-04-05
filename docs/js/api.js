import { API_BASE_URL, DEFAULT_COLOUR } from "./config.js";

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
    throw new Error("Missing API base URL. Update js/config.js with your Apps Script /exec URL.");
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
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json;
}

export async function getEntries(date) {
  return request("entries", { query: { date } });
}

export async function getEntriesInRange(startDate, endDate) {
  return request("entries", {
    query: {
      start_date: startDate,
      end_date: endDate,
    },
  });
}

export async function createEntry(entry) {
  return request("entries", { method: "POST", body: entry });
}

export async function deleteEntry(id) {
  return request("entries", {
    method: "POST",
    body: { _method: "DELETE", id },
  });
}

export async function getLegend() {
  return request("legend");
}

export async function upsertLegend(payload) {
  return request("legend", { method: "POST", body: payload });
}

export async function deleteLegend(colour) {
  return request("legend", {
    method: "POST",
    body: { _method: "DELETE", colour },
  });
}
