/*
 * app.js
 * Wires up the UI: loading JSON Resume data from a Gist, a raw URL, an uploaded
 * file, or pasted text, then rendering it with ResumeRenderer. Also handles
 * deep-linking via the URL query string (?gist=... / ?url=...) and printing.
 */
(function () {
  "use strict";

  var els = {
    form: document.getElementById("source-form"),
    input: document.getElementById("source-input"),
    loadBtn: document.getElementById("load-btn"),
    uploadBtn: document.getElementById("upload-btn"),
    fileInput: document.getElementById("file-input"),
    pasteBtn: document.getElementById("paste-btn"),
    pasteArea: document.getElementById("paste-area"),
    pasteInput: document.getElementById("paste-input"),
    pasteRenderBtn: document.getElementById("paste-render-btn"),
    pasteCancelBtn: document.getElementById("paste-cancel-btn"),
    sampleBtn: document.getElementById("sample-btn"),
    emptySampleBtn: document.getElementById("empty-sample-btn"),
    printBtn: document.getElementById("print-btn"),
    status: document.getElementById("status"),
    root: document.getElementById("resume-root"),
    emptyState: document.getElementById("empty-state")
  };

  /* ------------------------------------------------------------------ */
  /* Status helpers                                                     */
  /* ------------------------------------------------------------------ */

  function setStatus(message, kind) {
    els.status.textContent = message || "";
    els.status.className = "status" + (kind ? " status--" + kind : "");
  }

  /* ------------------------------------------------------------------ */
  /* Source parsing / fetching                                          */
  /* ------------------------------------------------------------------ */

  // Extract a 32-hex Gist id from a Gist URL or bare id. Returns null if the
  // input does not look like a Gist reference.
  function parseGistId(value) {
    if (typeof value !== "string") return null;
    var trimmed = value.trim();
    // Bare gist id (hex, typically 20 or 32 chars).
    if (/^[0-9a-f]{16,40}$/i.test(trimmed)) return trimmed;
    // gist.github.com/user/<id> or gist.github.com/<id>
    var match = /gist\.github\.com\/(?:[^\/]+\/)?([0-9a-f]{16,40})/i.exec(trimmed);
    if (match) return match[1];
    return null;
  }

  function pickResumeFromGist(gist) {
    var files = gist && gist.files;
    if (!files || typeof files !== "object") {
      throw new Error("The Gist did not contain any files.");
    }
    var names = Object.keys(files);
    // Prefer files that look like resume JSON, else the first .json, else first file.
    var preferred = names.filter(function (n) {
      return /resume.*\.json$/i.test(n) || n.toLowerCase() === "resume.json";
    });
    var jsonFiles = names.filter(function (n) { return /\.json$/i.test(n); });
    var chosenName = preferred[0] || jsonFiles[0] || names[0];
    var file = files[chosenName];
    if (!file) throw new Error("Could not find a JSON file in the Gist.");
    if (file.truncated && file.raw_url) {
      // Content was truncated by the API; fetch the raw file directly.
      return fetchText(file.raw_url).then(parseJson);
    }
    return Promise.resolve(parseJson(file.content));
  }

  function parseJson(text) {
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error("The file was empty.");
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error("The content is not valid JSON: " + err.message);
    }
  }

  function fetchText(url) {
    return fetch(url, { headers: { Accept: "application/vnd.github+json, application/json, */*" } })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Request failed (HTTP " + response.status + ").");
        }
        return response.text();
      });
  }

  function fetchJson(url) {
    return fetchText(url).then(parseJson);
  }

  // Resolve a user-entered source string to a resume object (Promise).
  function loadFromSource(value) {
    var gistId = parseGistId(value);
    if (gistId) {
      setStatus("Loading Gist \u2026", "loading");
      return fetchJson("https://api.github.com/gists/" + gistId).then(pickResumeFromGist);
    }
    var trimmed = (value || "").trim();
    if (/^https?:\/\//i.test(trimmed)) {
      setStatus("Loading \u2026", "loading");
      return fetchJson(trimmed);
    }
    return Promise.reject(new Error("Enter a Gist link/ID or a URL starting with http(s)://."));
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function renderResume(resume, successMessage) {
    var fragment;
    try {
      fragment = window.ResumeRenderer.render(resume);
    } catch (err) {
      setStatus(err.message, "error");
      return;
    }
    els.root.innerHTML = "";
    els.root.appendChild(fragment);
    setStatus(successMessage || "", "success");

    // Update page title with the person's name, when available.
    var name = resume.basics && resume.basics.name;
    if (name) document.title = name + " \u2014 Resume";

    // Move keyboard focus to the top of the rendered resume for accessibility.
    els.root.setAttribute("tabindex", "-1");
    els.root.focus({ preventScroll: false });
  }

  function handleError(err) {
    setStatus(err && err.message ? err.message : String(err), "error");
  }

  /* ------------------------------------------------------------------ */
  /* Event wiring                                                       */
  /* ------------------------------------------------------------------ */

  els.form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = els.input.value;
    if (!value || !value.trim()) {
      setStatus("Please enter a Gist link/ID or a URL.", "error");
      return;
    }
    loadFromSource(value)
      .then(function (resume) {
        updateQueryString(value);
        renderResume(resume, "Loaded successfully.");
      })
      .catch(handleError);
  });

  els.uploadBtn.addEventListener("click", function () {
    els.fileInput.click();
  });

  els.fileInput.addEventListener("change", function () {
    var file = els.fileInput.files && els.fileInput.files[0];
    if (!file) return;
    setStatus("Reading file \u2026", "loading");
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var resume = parseJson(String(reader.result));
        renderResume(resume, "Loaded from file.");
      } catch (err) {
        handleError(err);
      }
    };
    reader.onerror = function () {
      setStatus("Could not read the selected file.", "error");
    };
    reader.readAsText(file);
    // Reset so selecting the same file again re-triggers change.
    els.fileInput.value = "";
  });

  els.pasteBtn.addEventListener("click", function () {
    var hidden = els.pasteArea.hasAttribute("hidden");
    if (hidden) {
      els.pasteArea.removeAttribute("hidden");
      els.pasteInput.focus();
    } else {
      els.pasteArea.setAttribute("hidden", "");
    }
  });

  els.pasteCancelBtn.addEventListener("click", function () {
    els.pasteArea.setAttribute("hidden", "");
  });

  els.pasteRenderBtn.addEventListener("click", function () {
    try {
      var resume = parseJson(els.pasteInput.value);
      els.pasteArea.setAttribute("hidden", "");
      renderResume(resume, "Rendered from pasted JSON.");
    } catch (err) {
      handleError(err);
    }
  });

  function loadSample() {
    setStatus("Loading sample \u2026", "loading");
    fetchJson("sample-resume.json")
      .then(function (resume) {
        renderResume(resume, "Showing sample resume. Load your own to replace it.");
      })
      .catch(handleError);
  }

  els.sampleBtn.addEventListener("click", loadSample);
  if (els.emptySampleBtn) els.emptySampleBtn.addEventListener("click", loadSample);

  els.printBtn.addEventListener("click", function () {
    window.print();
  });

  /* ------------------------------------------------------------------ */
  /* Deep linking via query string                                      */
  /* ------------------------------------------------------------------ */

  function updateQueryString(value) {
    if (!window.history || !window.history.replaceState) return;
    var gistId = parseGistId(value);
    var params = new URLSearchParams();
    if (gistId) {
      params.set("gist", gistId);
    } else {
      params.set("url", value.trim());
    }
    var newUrl = window.location.pathname + "?" + params.toString();
    window.history.replaceState(null, "", newUrl);
  }

  function loadFromQueryString() {
    var params = new URLSearchParams(window.location.search);
    var gist = params.get("gist");
    var url = params.get("url");
    var source = gist || url;
    if (!source) return false;
    els.input.value = source;
    loadFromSource(source)
      .then(function (resume) {
        renderResume(resume, "Loaded successfully.");
      })
      .catch(handleError);
    return true;
  }

  // On first load, honour ?gist= / ?url= if present.
  loadFromQueryString();
})();
