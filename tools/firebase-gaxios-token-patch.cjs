const gaxios = require("C:/Users/Scion/AppData/Roaming/npm/node_modules/firebase-tools/node_modules/gaxios");
const nodeFetchPath = require.resolve("C:/Users/Scion/AppData/Roaming/npm/node_modules/firebase-tools/node_modules/node-fetch");
const nodeFetch = require(nodeFetchPath);

const originalRequest = gaxios.request;
const originalPrototypeRequest = gaxios.Gaxios && gaxios.Gaxios.prototype._request;

function normalizeHeaders(headers) {
  if (!headers) return headers;
  if (typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return headers;
}

async function nativeFetch(url, options = {}) {
  const nextOptions = {
    ...options,
    headers: normalizeHeaders(options.headers),
  };

  if (nextOptions.body && typeof nextOptions.body.pipe === "function") {
    nextOptions.duplex = "half";
  }

  return globalThis.fetch(url, {
    ...nextOptions,
  });
}

Object.assign(nativeFetch, nodeFetch);
nativeFetch.default = nativeFetch;
require.cache[nodeFetchPath].exports = nativeFetch;

async function fetchToken(options) {
  const url = typeof options === "string" ? options : options && options.url;

  if (url === "https://www.googleapis.com/oauth2/v4/token") {
    const body =
      options.data instanceof URLSearchParams
        ? options.data
        : new URLSearchParams(options.data || {});

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error_description || data.error || `Token request failed: ${response.status}`);
      error.response = { status: response.status, data };
      throw error;
    }

    return {
      config: options,
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  return null;
}

gaxios.request = async function patchedRequest(options) {
  const tokenResponse = await fetchToken(options);
  if (tokenResponse) return tokenResponse;
  return originalRequest.apply(this, arguments);
};

if (gaxios.Gaxios && originalPrototypeRequest) {
  gaxios.Gaxios.prototype._request = async function patchedPrototypeRequest(options) {
    const tokenResponse = await fetchToken(options);
    if (tokenResponse) return tokenResponse;
    return originalPrototypeRequest.apply(this, arguments);
  };
}
