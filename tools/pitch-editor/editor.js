(function () {
  "use strict";

  var frame = document.getElementById("pitch-frame");
  var saveButton = document.getElementById("save-button");
  var reloadButton = document.getElementById("reload-button");
  var addButton = document.getElementById("add-button");
  var duplicateButton = document.getElementById("duplicate-button");
  var deleteButton = document.getElementById("delete-button");
  var saveState = document.getElementById("save-state");
  var selectionType = document.getElementById("selection-type");
  var selectionTitle = document.getElementById("selection-title");
  var selectionPreview = document.getElementById("selection-preview");
  var sectionList = document.getElementById("section-list");
  var confirmDialog = document.getElementById("confirm-dialog");

  var editableSelector = [
    "h2.title",
    "h3",
    "p",
    "th",
    "td",
    "dt",
    "dd",
    "figcaption",
    ".cover-meta > b",
    ".cover-meta > span",
    ".studio-name",
    ".studio-loc",
    ".big",
    ".num",
    ".st",
    ".badge",
    ".pn-sub",
    ".sig > span",
    "a.btn"
  ].join(",");

  var groupSelectors = ["tr", ".card", ".road-row", ".feat", ".ask"];
  var selected = null;
  var dirty = false;
  var saving = false;
  var editorStyleId = "pitch-editor-runtime-style";
  var sourceHeadHtml = "";

  function setState(message, className) {
    saveState.textContent = message;
    saveState.className = "save-state" + (className ? " " + className : "");
  }

  function setDirty(value) {
    dirty = value;
    saveButton.disabled = !value || saving;
    if (value) setState("Unsaved changes", "dirty");
  }

  function currentDocument() {
    return frame.contentDocument;
  }

  function textSummary(element) {
    return (element && element.textContent ? element.textContent : "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function logicalGroup(element) {
    if (!element) return null;
    for (var i = 0; i < groupSelectors.length; i += 1) {
      var group = element.closest(groupSelectors[i]);
      if (group) return group;
    }
    if (element.matches("dt, dd")) return element.parentElement;
    return null;
  }

  function selectElement(element, focus) {
    if (!element || !element.matches(editableSelector)) return;
    if (selected) selected.classList.remove("pitch-editor-selected");
    selected = element;
    selected.classList.add("pitch-editor-selected");
    if (focus) selected.focus({ preventScroll: true });

    var summary = textSummary(selected);
    selectionType.textContent = selected.tagName.toLowerCase() + formatClassName(selected);
    selectionTitle.textContent = summary || "Empty text block";
    selectionPreview.textContent = "Type directly in the highlighted block. Add text inserts a paragraph after it.";
    addButton.disabled = false;
    deleteButton.disabled = false;

    var group = logicalGroup(selected);
    duplicateButton.disabled = !group;
    duplicateButton.textContent = group ? "Duplicate " + groupLabel(group) : "Duplicate block";

    var section = selected.closest(".deck > section");
    if (section) activateSection(section);
  }

  function formatClassName(element) {
    var useful = Array.prototype.filter.call(element.classList, function (className) {
      return className.indexOf("pitch-editor-") !== 0;
    });
    return useful.length ? "." + useful[0] : "";
  }

  function groupLabel(group) {
    if (group.matches("tr")) return "row";
    if (group.matches(".road-row")) return "roadmap item";
    if (group.matches(".feat")) return "feature";
    if (group.matches(".ask")) return "ask item";
    return "card";
  }

  function prepareEditable(element) {
    if (!element.matches(editableSelector)) return;
    element.setAttribute("contenteditable", "true");
    element.setAttribute("spellcheck", "true");
    element.classList.add("pitch-editor-editable");
    element.addEventListener("input", function () {
      setDirty(true);
      if (element === selected) selectionTitle.textContent = textSummary(element) || "Empty text block";
    });
    element.addEventListener("focus", function () { selectElement(element, false); });
  }

  function prepareAll(root) {
    var elements = root.querySelectorAll(editableSelector);
    for (var i = 0; i < elements.length; i += 1) prepareEditable(elements[i]);
  }

  function installEditorStyles(doc) {
    var style = doc.createElement("style");
    style.id = editorStyleId;
    style.setAttribute("data-pitch-editor-runtime", "true");
    style.textContent = [
      ".pitch-editor-editable { outline: 1px dashed rgba(77,231,255,.45); outline-offset: 4px; cursor: text; transition: outline-color .12s, background .12s; }",
      ".pitch-editor-editable:hover { outline-color: #4de7ff; background: rgba(77,231,255,.08); }",
      ".pitch-editor-selected { outline: 3px solid #ff4f9a !important; outline-offset: 5px !important; background: rgba(255,79,154,.12) !important; }",
      ".pitch-editor-editable:focus { outline: 3px solid #4de7ff; outline-offset: 5px; background: rgba(77,231,255,.11); }",
      "a.pitch-editor-editable { pointer-events: auto; }"
    ].join("\n");
    doc.head.appendChild(style);
  }

  function sectionName(section, index) {
    if (section.matches(".cover")) return "Cover";
    var title = section.querySelector("h2.title");
    return textSummary(title) || "Section " + (index + 1);
  }

  function renderSections(doc) {
    sectionList.replaceChildren();
    var sections = doc.querySelectorAll(".deck > section");
    for (var i = 0; i < sections.length; i += 1) {
      (function (section, index) {
        var button = document.createElement("button");
        button.className = "section-link";
        button.type = "button";
        button.textContent = sectionName(section, index);
        button.dataset.sectionIndex = String(index);
        button.addEventListener("click", function () {
          section.scrollIntoView({ behavior: "smooth", block: "start" });
          activateSection(section);
        });
        sectionList.appendChild(button);
      })(sections[i], i);
    }
  }

  function activateSection(section) {
    var doc = currentDocument();
    if (!doc) return;
    var sections = Array.prototype.slice.call(doc.querySelectorAll(".deck > section"));
    var index = sections.indexOf(section);
    var buttons = sectionList.querySelectorAll(".section-link");
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].classList.toggle("active", i === index);
    }
  }

  function resetSelection() {
    if (selected) selected.classList.remove("pitch-editor-selected");
    selected = null;
    selectionType.textContent = "None";
    selectionTitle.textContent = "Choose text in the preview";
    selectionPreview.textContent = "The selected block and its editing controls will appear here.";
    addButton.disabled = true;
    duplicateButton.disabled = true;
    duplicateButton.textContent = "Duplicate block";
    deleteButton.disabled = true;
  }

  async function onFrameLoad() {
    var doc = currentDocument();
    if (!doc || !doc.querySelector(".deck")) {
      setState("Pitch failed to load", "error");
      return;
    }

    resetSelection();
    setState("Preparing editor…", "");
    try {
      var sourceResponse = await fetch("/pitch?pitch-editor-source=1&t=" + Date.now(), { cache: "no-store" });
      if (!sourceResponse.ok) throw new Error("Pitch source failed to load");
      var sourceDocument = new DOMParser().parseFromString(await sourceResponse.text(), "text/html");
      sourceHeadHtml = sourceDocument.head.innerHTML;
    } catch (error) {
      setState(error.message || "Pitch source failed to load", "error");
      return;
    }

    installEditorStyles(doc);
    prepareAll(doc);
    renderSections(doc);
    setDirty(false);
    setState("Ready", "saved");
    saveButton.disabled = true;

    doc.addEventListener("click", function (event) {
      var editable = event.target.closest(editableSelector);
      if (editable) {
        if (editable.closest("a")) event.preventDefault();
        selectElement(editable, false);
      }
    }, true);

    doc.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        savePitch();
      }
    });
  }

  function paragraphInsertionPoint(element) {
    if (element.closest(".title-wrap")) return element.closest(".title-wrap");
    if (element.matches("th, td")) return element.closest("table");
    if (element.matches("dt, dd")) return element.closest("dl");
    if (element.closest(".cover-meta, .links")) return element.closest(".cover-meta, .links");
    return element;
  }

  function addTextAfter() {
    if (!selected) return;
    var doc = currentDocument();
    var paragraph = doc.createElement("p");
    paragraph.textContent = "New text";
    var point = paragraphInsertionPoint(selected);
    point.insertAdjacentElement("afterend", paragraph);
    prepareEditable(paragraph);
    selectElement(paragraph, true);
    paragraph.scrollIntoView({ behavior: "smooth", block: "center" });
    setDirty(true);
  }

  function duplicateBlock() {
    var group = logicalGroup(selected);
    if (!group) return;
    var clone = group.cloneNode(true);
    clone.querySelectorAll("[contenteditable], [spellcheck]").forEach(function (element) {
      element.removeAttribute("contenteditable");
      element.removeAttribute("spellcheck");
      element.classList.remove("pitch-editor-editable", "pitch-editor-selected");
    });
    group.insertAdjacentElement("afterend", clone);
    prepareAll(clone);
    var firstEditable = clone.matches(editableSelector) ? clone : clone.querySelector(editableSelector);
    if (firstEditable) selectElement(firstEditable, true);
    clone.scrollIntoView({ behavior: "smooth", block: "center" });
    setDirty(true);
  }

  function deleteSelected() {
    if (!selected) return;
    var target = selected;
    var group = logicalGroup(selected);
    if (group && (selected.matches("th, td") || group.matches(".road-row, .feat, .ask, .card"))) {
      target = group;
    }
    var next = target.nextElementSibling || target.previousElementSibling || target.parentElement;
    target.remove();
    resetSelection();
    if (next) {
      var nextEditable = next.matches && next.matches(editableSelector) ? next : next.querySelector && next.querySelector(editableSelector);
      if (nextEditable) selectElement(nextEditable, false);
    }
    setDirty(true);
  }

  function cleanClone(doc) {
    var clone = doc.documentElement.cloneNode(true);
    var cloneHead = clone.querySelector("head");
    if (cloneHead && sourceHeadHtml) cloneHead.innerHTML = sourceHeadHtml;
    clone.querySelectorAll("[data-pitch-editor-runtime]").forEach(function (element) { element.remove(); });
    clone.querySelectorAll("[contenteditable], [spellcheck]").forEach(function (element) {
      element.removeAttribute("contenteditable");
      element.removeAttribute("spellcheck");
    });
    clone.querySelectorAll(".pitch-editor-editable, .pitch-editor-selected").forEach(function (element) {
      element.classList.remove("pitch-editor-editable", "pitch-editor-selected");
      if (!element.getAttribute("class")) element.removeAttribute("class");
    });
    return "<!doctype html>\n" + clone.outerHTML + "\n";
  }

  async function savePitch() {
    if (!dirty || saving) return;
    var doc = currentDocument();
    if (!doc) return;
    saving = true;
    saveButton.disabled = true;
    setState("Saving…", "dirty");
    try {
      var response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: cleanClone(doc) })
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed");
      dirty = false;
      setState("Saved · backup created", "saved");
      window.setTimeout(function () {
        if (!dirty) setState("Saved", "saved");
      }, 2500);
    } catch (error) {
      setState(error.message || "Save failed", "error");
      saveButton.disabled = false;
    } finally {
      saving = false;
      saveButton.disabled = !dirty;
    }
  }

  function reloadPitch(force) {
    if (dirty && !force) {
      confirmDialog.showModal();
      return;
    }
    resetSelection();
    setState("Loading pitch…", "");
    frame.src = "/pitch?pitch-editor=1&t=" + Date.now();
  }

  saveButton.addEventListener("click", savePitch);
  reloadButton.addEventListener("click", function () { reloadPitch(false); });
  addButton.addEventListener("click", addTextAfter);
  duplicateButton.addEventListener("click", duplicateBlock);
  deleteButton.addEventListener("click", deleteSelected);
  frame.addEventListener("load", onFrameLoad);

  confirmDialog.addEventListener("close", function () {
    if (confirmDialog.returnValue === "confirm") reloadPitch(true);
  });

  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      savePitch();
    }
  });

  window.addEventListener("beforeunload", function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  reloadPitch(true);
})();
