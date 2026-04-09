// ==UserScript==
// @name         SfcSummary Date Sync
// @namespace    https://uuapp.plus4u.net/
// @version      1.4.1
// @description  Hromadná změna datumového intervalu pro všechny UuFinMan.BI.SfcSummary komponenty na stránce
// @author       SWF
// @match        https://uuapp.plus4u.net/uu-managementkit-maing02/c6726701235c4f2d85736a4602295884/document*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const CONFIG = {
    pageOid: "66432e7fc434ea00346e6696",
    componentHeadingText: "Specific Financial Categories Summary",
    modalTitleText: "Nastavení filtru",
    confirmButtonText: "Potvrdit",
    dateFromLabel: "Období od",
    dateToLabel: "Období do",
    timings: {
      afterFilterClick: 1000,
      afterDateSet: 500,
      afterConfirm: 1500,
      pollInterval: 200,
      modalTimeout: 3000,
      modalCloseTimeout: 3000,
    },
    debug: true,
  };

  function log(...args) {
    if (CONFIG.debug) console.log("[SfcDateSync]", ...args);
  }

  function warn(...args) {
    console.warn("[SfcDateSync]", ...args);
  }

  // ─── PAGE GUARD ────────────────────────────────────────────────────────────
  if (!location.search.includes(CONFIG.pageOid)) {
    log("Not the target page, skipping.");
    return;
  }

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const STYLES = `
    #sfc-date-sync-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
      color: #fff;
      padding: 8px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      flex-wrap: wrap;
    }
    #sfc-date-sync-bar .sfc-label {
      font-weight: 600;
      white-space: nowrap;
    }
    #sfc-date-sync-bar .sfc-field-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #sfc-date-sync-bar .sfc-field-label {
      opacity: 0.85;
      font-size: 12px;
      white-space: nowrap;
    }
    #sfc-date-sync-bar input[type="date"] {
      padding: 4px 8px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      background: rgba(255,255,255,0.15);
      color: #fff;
      font-size: 13px;
      outline: none;
      cursor: pointer;
    }
    #sfc-date-sync-bar input[type="date"]:focus {
      border-color: rgba(255,255,255,0.7);
      background: rgba(255,255,255,0.25);
    }
    #sfc-date-sync-bar input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
      cursor: pointer;
    }
    #sfc-date-sync-bar .sfc-btn {
      padding: 5px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      white-space: nowrap;
    }
    #sfc-date-sync-bar .sfc-btn:active {
      transform: scale(0.97);
    }
    #sfc-date-sync-bar .sfc-btn-apply {
      background: #4caf50;
      color: #fff;
    }
    #sfc-date-sync-bar .sfc-btn-apply:hover {
      background: #43a047;
    }
    #sfc-date-sync-bar .sfc-btn-apply:disabled {
      background: #666;
      cursor: not-allowed;
      transform: none;
    }
    #sfc-date-sync-bar .sfc-btn-close {
      background: transparent;
      color: rgba(255,255,255,0.7);
      font-size: 18px;
      padding: 2px 8px;
      margin-left: auto;
    }
    #sfc-date-sync-bar .sfc-btn-close:hover {
      color: #fff;
    }
    #sfc-date-sync-bar .sfc-status {
      font-size: 12px;
      opacity: 0.9;
      min-width: 120px;
    }
    #sfc-date-sync-bar .sfc-status.sfc-error {
      color: #ff8a80;
    }
    #sfc-date-sync-bar .sfc-status.sfc-success {
      color: #b9f6ca;
    }
    #sfc-date-sync-bar .sfc-status.sfc-working {
      color: #fff59d;
    }
    #sfc-date-sync-bar.sfc-minimized {
      padding: 4px 12px;
    }
    #sfc-date-sync-bar.sfc-minimized .sfc-field-group,
    #sfc-date-sync-bar.sfc-minimized .sfc-btn-apply,
    #sfc-date-sync-bar.sfc-minimized .sfc-status {
      display: none;
    }
  `;

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForElement(predicate, timeout = CONFIG.timings.modalTimeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = predicate();
        if (el) return resolve(el);
        if (Date.now() - start > timeout) {
          return reject(new Error("waitForElement timeout"));
        }
        setTimeout(check, CONFIG.timings.pollInterval);
      };
      check();
    });
  }

  function waitForNoElement(predicate, timeout = CONFIG.timings.modalCloseTimeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = predicate();
        if (!el) return resolve();
        if (Date.now() - start > timeout) {
          return reject(new Error("waitForNoElement timeout"));
        }
        setTimeout(check, CONFIG.timings.pollInterval);
      };
      check();
    });
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function parseIsoDateParts(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((isoDate || "").trim());
    if (!match) return null;

    const [, year, month, day] = match;
    return {
      year,
      month,
      day,
      monthNum: String(Number(month)),
      dayNum: String(Number(day)),
    };
  }

  function normalizeDateValue(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return null;

    let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }

    match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
    if (match) {
      return `${match[3]}-${pad2(match[2])}-${pad2(match[1])}`;
    }

    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (match) {
      return `${match[3]}-${pad2(match[1])}-${pad2(match[2])}`;
    }

    return null;
  }

  function isDateLikeValue(value) {
    return !!normalizeDateValue(value);
  }

  function buildDateInputCandidates(isoDate) {
    const parts = parseIsoDateParts(isoDate);
    if (!parts) return [isoDate];

    const { year, month, day, monthNum, dayNum } = parts;
    const dotCandidates = [
      `${day}.${month}.${year}`,
      `${dayNum}.${month}.${year}`,
      `${day}.${monthNum}.${year}`,
      `${dayNum}.${monthNum}.${year}`,
    ];
    const slashCandidates = [
      `${month}/${day}/${year}`,
      `${monthNum}/${day}/${year}`,
      `${month}/${dayNum}/${year}`,
      `${monthNum}/${dayNum}/${year}`,
    ];

    return Array.from(new Set([
      ...dotCandidates,
      ...slashCandidates,
      `${year}-${month}-${day}`,
    ]));
  }

  function getOrderedDateInputCandidates(isoDate, input) {
    const candidates = buildDateInputCandidates(isoDate);
    const currentValue = input?.value || "";
    const placeholder = input?.placeholder || "";
    const hints = [currentValue, placeholder].filter(Boolean);
    const families = [];

    if (input?.type === "date" || hints.some((hint) => hint.includes("-"))) families.push("iso");
    if (hints.some((hint) => hint.includes("/"))) families.push("slash");
    if (hints.some((hint) => hint.includes("."))) families.push("dot");
    if (families.length === 0) families.push("dot", "slash", "iso");

    const ordered = [];
    const pushUnique = (value) => {
      if (value && !ordered.includes(value)) ordered.push(value);
    };
    const getFamily = (value) => {
      if (value.includes("/")) return "slash";
      if (value.includes(".")) return "dot";
      if (value.includes("-")) return "iso";
      return "other";
    };

    for (const hint of hints) {
      if (candidates.includes(hint)) pushUnique(hint);
    }

    for (const family of families) {
      for (const candidate of candidates) {
        if (getFamily(candidate) === family) pushUnique(candidate);
      }
    }

    for (const candidate of candidates) pushUnique(candidate);
    return ordered;
  }

  function hasExpectedDateValue(input, expectedIsoDate, attemptedValue) {
    return input.value === attemptedValue || normalizeDateValue(input.value) === expectedIsoDate;
  }

  function getReactProps(element) {
    const key = Object.keys(element).find((k) => k.startsWith("__reactProps$"));
    return key ? element[key] : null;
  }

  function getReactFiber(element) {
    const key = Object.keys(element).find(
      (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
    );
    return key ? element[key] : null;
  }

  function findReactOnChange(input) {
    const props = getReactProps(input);
    if (props?.onChange) return props.onChange;

    let fiber = getReactFiber(input);
    for (let i = 0; i < 15 && fiber; i++) {
      const p = fiber.memoizedProps || fiber.pendingProps;
      if (p?.onChange) return p.onChange;
      fiber = fiber.return;
    }
    return null;
  }

  function triggerReactChange(input, value) {
    const onChange = findReactOnChange(input);
    if (!onChange) return false;
    try {
      onChange({ target: { value }, currentTarget: { value } });
      log("    React onChange triggered directly");
      return true;
    } catch (e) {
      log("    React onChange call failed:", e.message);
    }
    try {
      const ev = new Event("input", { bubbles: true });
      Object.defineProperty(ev, "target", { writable: false, value: { value } });
      onChange(ev);
      log("    React onChange triggered via synthetic event");
      return true;
    } catch (e2) {
      log("    React onChange synthetic also failed:", e2.message);
    }
    return false;
  }

  async function setDatePickerValue(input, isoDate) {
    const candidates = getOrderedDateInputCandidates(isoDate, input);
    log(
      `    Attempting to set ISO date "${isoDate}" ` +
      `(current: "${input.value}", candidates: ${candidates.join(" | ")})`
    );

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    ).set;

    for (const candidate of candidates) {
      log(`    Trying candidate "${candidate}"`);

      // --- Strategy 1: document.execCommand('insertText') ---
      input.focus();
      await sleep(150);
      input.select();
      document.execCommand("selectAll", false, null);
      await sleep(50);
      document.execCommand("insertText", false, candidate);
      await sleep(200);

      if (hasExpectedDateValue(input, isoDate, candidate)) {
        log(`    Strategy 1 (execCommand) succeeded with "${candidate}"`);
        input.blur();
        await sleep(100);
        return;
      }
      log(`    Strategy 1 failed: value="${input.value}"`);

      // --- Strategy 2: React onChange via fiber ---
      const changed = triggerReactChange(input, candidate);
      if (changed) {
        await sleep(200);
        if (hasExpectedDateValue(input, isoDate, candidate)) {
          log(`    Strategy 2 (React onChange) succeeded with "${candidate}"`);
          input.blur();
          await sleep(100);
          return;
        }
        log(`    Strategy 2 changed value to "${input.value}"`);
      } else {
        log("    Strategy 2 skipped: no React onChange found");
      }

      // --- Strategy 3: nativeInputValueSetter + InputEvent ---
      nativeSetter.call(input, candidate);
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: candidate,
        })
      );
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(200);

      if (hasExpectedDateValue(input, isoDate, candidate)) {
        log(`    Strategy 3 (nativeSetter+InputEvent) succeeded with "${candidate}"`);
        input.blur();
        await sleep(100);
        return;
      }
      log(`    Strategy 3 failed: value="${input.value}"`);

      // --- Strategy 4: character-by-character via execCommand ---
      log("    Strategy 4: clearing and typing char-by-char via execCommand");
      input.focus();
      await sleep(100);
      input.select();
      document.execCommand("delete", false, null);
      await sleep(50);

      for (const char of candidate) {
        document.execCommand("insertText", false, char);
        await sleep(30);
      }
      await sleep(150);

      if (hasExpectedDateValue(input, isoDate, candidate)) {
        log(`    Strategy 4 (char-by-char) succeeded with "${candidate}"`);
        input.blur();
        await sleep(100);
        return;
      }
      log(`    Strategy 4 failed: value="${input.value}"`);
    }

    input.blur();
    await sleep(100);
    throw new Error(`Nepodařilo se nastavit datum "${isoDate}" do inputu`);
  }

  function findElementByText(root, selector, text) {
    const elements = root.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent.trim().includes(text)) return el;
    }
    return null;
  }

  function findAllElementsByText(root, selector, text) {
    const result = [];
    const elements = root.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent.trim().includes(text)) result.push(el);
    }
    return result;
  }

  function simulateClick(element) {
    // Use the page-context constructors via unsafeWindow so React's
    // event delegation (which checks instanceof) recognises the event.
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const ME = win.MouseEvent;

    element.dispatchEvent(new ME("pointerdown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new ME("mousedown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new ME("pointerup", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new ME("mouseup", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new ME("click", { bubbles: true, cancelable: true }));
  }

  function reactClick(element) {
    let fiber = getReactFiber(element);
    for (let i = 0; i < 20 && fiber; i++) {
      const p = fiber.memoizedProps || fiber.pendingProps;
      if (p?.onClick) {
        log("    Found React onClick at fiber depth", i);
        try {
          p.onClick(new (unsafeWindow || window).MouseEvent("click", { bubbles: true }));
          return true;
        } catch (e) {
          log("    React onClick threw:", e.message);
        }
        try {
          p.onClick({ preventDefault() {}, stopPropagation() {}, nativeEvent: {} });
          return true;
        } catch (e2) {
          log("    React onClick (synth) threw:", e2.message);
        }
      }
      fiber = fiber.return;
    }
    return false;
  }

  // ─── CORE LOGIC ────────────────────────────────────────────────────────────

  function findSfcComponents() {
    const headings = findAllElementsByText(
      document,
      "span, div, h1, h2, h3, h4, h5, h6, p, [class*='header'], [class*='Header']",
      CONFIG.componentHeadingText
    );

    const uniqueHeadings = headings.filter((h) => {
      const text = h.textContent.trim();
      return (
        text.startsWith(CONFIG.componentHeadingText) &&
        text.length < CONFIG.componentHeadingText.length + 20
      );
    });

    log(`Found ${uniqueHeadings.length} heading elements for "${CONFIG.componentHeadingText}"`);

    const components = [];
    const seenWrappers = new Set();

    for (const heading of uniqueHeadings) {
      let candidate = heading;
      for (let depth = 0; depth < 20; depth++) {
        candidate = candidate.parentElement;
        if (!candidate) break;

        const buttons = candidate.querySelectorAll("button, [role='button']");
        const hasEnoughButtons = buttons.length >= 3;
        const hasDataTable =
          candidate.querySelector("table, [class*='table'], [class*='Table']") !== null;
        const hasContext =
          candidate.textContent.includes("Business Case") ||
          candidate.textContent.includes("Období od");

        if (hasEnoughButtons && (hasDataTable || hasContext)) {
          if (!seenWrappers.has(candidate)) {
            seenWrappers.add(candidate);
            components.push({ wrapper: candidate, heading });
            log(`  Component wrapper found at depth ${depth}, buttons: ${buttons.length}`);
          }
          break;
        }
      }
    }

    log(`Resolved ${components.length} SfcSummary component wrappers`);
    return components;
  }

  function findFilterButton(componentWrapper) {
    const headingEl = findElementByText(
      componentWrapper,
      "span, div, h1, h2, h3, h4, h5, h6",
      CONFIG.componentHeadingText
    );

    let headerRow = null;
    if (headingEl) {
      let el = headingEl;
      for (let i = 0; i < 5; i++) {
        el = el.parentElement;
        if (!el) break;
        const btns = el.querySelectorAll(":scope > button, :scope > div > button, :scope > [role='button'], :scope > div > [role='button']");
        if (btns.length >= 2) {
          headerRow = el;
          break;
        }
      }
    }

    const searchRoot = headerRow || componentWrapper;
    const buttons = searchRoot.querySelectorAll("button, [role='button']");
    log(`  Searching ${buttons.length} buttons in ${headerRow ? "header row" : "full wrapper"}`);

    for (const btn of buttons) {
      const allClasses = Array.from(btn.querySelectorAll("*"))
        .map((e) => e.className || "")
        .join(" ") + " " + (btn.className || "");
      if (/filter|Filter|funnel|Funnel|tune|Tune/i.test(allClasses)) {
        log("  Found filter button by icon/class name:", allClasses.substring(0, 80));
        return btn;
      }
    }

    for (const btn of buttons) {
      const attrs = (btn.getAttribute("title") || "") +
        (btn.getAttribute("aria-label") || "") +
        (btn.getAttribute("data-tooltip") || "");
      if (/filtr|filter|nastavení/i.test(attrs)) {
        log("  Found filter button by title/aria-label");
        return btn;
      }
    }

    for (const btn of buttons) {
      const svg = btn.querySelector("svg");
      if (!svg) continue;
      const paths = svg.querySelectorAll("path");
      for (const p of paths) {
        const d = (p.getAttribute("d") || "").replace(/\s/g, "");
        if (
          d.includes("4.62") || d.includes("filter") ||
          d.includes("19.79,4.62") || d.includes("M14,12V19")
        ) {
          log("  Found filter button by SVG path pattern");
          return btn;
        }
      }
    }

    if (headerRow) {
      const headerBtns = Array.from(headerRow.querySelectorAll("button, [role='button']"));
      const iconOnlyBtns = headerBtns.filter((b) => {
        const text = b.textContent.trim();
        return text.length < 3;
      });

      if (iconOnlyBtns.length >= 2) {
        log(`  Using first icon-only button in header (${iconOnlyBtns.length} found)`);
        return iconOnlyBtns[0];
      }
      if (headerBtns.length > 0) {
        log(`  Using first header button (${headerBtns.length} found)`);
        return headerBtns[0];
      }
    }

    const allBtns = Array.from(componentWrapper.querySelectorAll("button, [role='button']"));
    const iconBtns = allBtns.filter((b) => {
      const text = b.textContent.trim();
      return text.length < 3 && (b.querySelector("svg") || b.querySelector("[class*='icon'], [class*='Icon']"));
    });

    if (iconBtns.length >= 3) {
      log(`  Last resort: first icon button of ${iconBtns.length}`);
      return iconBtns[0];
    }

    warn("  Could not find filter button!");
    return null;
  }

  function findModal() {
    const doc = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window).document;

    // UU5 g04 modal classes: uu5-bricks-modal, uu5-bricks-modal-dialog
    // UU5 g05 modal: uu5-elements-modal, Uu5Elements.Modal
    // Generic: role="dialog", [class*='modal']
    const selectors = [
      ".uu5-bricks-modal",
      ".uu5-bricks-modal-dialog",
      "[class*='uu5'][class*='modal']",
      "[class*='Modal']",
      "[role='dialog']",
      "[class*='dialog']",
    ];

    for (const sel of selectors) {
      const matches = doc.querySelectorAll(sel);
      for (const el of matches) {
        if (el.textContent.includes(CONFIG.modalTitleText)) {
          return el;
        }
      }
    }

    // Brute-force: walk all elements at body top-level (portals)
    for (const child of doc.body.children) {
      if (
        child.id !== "sfc-date-sync-bar" &&
        child.textContent.includes(CONFIG.modalTitleText) &&
        child.querySelector("input")
      ) {
        log("    Found modal via body child scan");
        return child;
      }
    }

    return null;
  }

  const INPUT_SEL = "input[type='text'], input[type='date'], input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='submit'])";

  // Finds the input that belongs to a specific label element.
  // Only looks WITHIN the label's own form-group ancestor (stops before
  // entering a sibling form-group that also contains inputs).
  function findInputForLabel(labelEl, modal) {
    // Walk UP from the label until we reach a container that has exactly 1 input.
    // This is the form-group that owns this label+input pair.
    let container = labelEl.parentElement;
    while (container && container !== modal) {
      const inputs = container.querySelectorAll(INPUT_SEL);
      if (inputs.length === 1) {
        log(`    Form-group found with 1 input: ${inputs[0].value}`);
        return inputs[0];
      }
      if (inputs.length === 0) {
        container = container.parentElement;
        continue;
      }
      // inputs.length > 1: this container is too wide (spans multiple fields).
      // Check if label is in the first or second half of its children by
      // finding which sub-tree the label belongs to.
      for (const inp of inputs) {
        // If the label and the input share a common ancestor that has only 1 input
        // between them, that's our pair.
        const lca = findLowestCommonAncestor(labelEl, inp, container);
        if (lca && lca !== container) {
          const inputsInLca = lca.querySelectorAll(INPUT_SEL);
          if (inputsInLca.length === 1) {
            log(`    Paired via LCA with 1 input: ${inp.value}`);
            return inp;
          }
        }
      }
      // Can't narrow further - break
      break;
    }
    return null;
  }

  function findLowestCommonAncestor(el1, el2, stopAt) {
    const ancestors1 = new Set();
    let e = el1;
    while (e && e !== stopAt) {
      ancestors1.add(e);
      e = e.parentElement;
    }
    e = el2;
    while (e && e !== stopAt) {
      if (ancestors1.has(e)) return e;
      e = e.parentElement;
    }
    return null;
  }

  // Main entry: finds BOTH date inputs in one pass and returns { fromInput, toInput }.
  function findBothDateInputs(modal) {
    // --- Primary strategy: find labels, pair each with its own input ---
    const allLabels = Array.from(modal.querySelectorAll("label, span, div, p")).filter((el) => {
      const t = el.textContent.trim();
      return (
        (t === CONFIG.dateFromLabel || t === CONFIG.dateToLabel) &&
        el.children.length === 0  // leaf text node only
      );
    });

    log(`  Found ${allLabels.length} exact date labels in modal`);

    let fromInput = null;
    let toInput = null;

    for (const label of allLabels) {
      const t = label.textContent.trim();
      const inp = findInputForLabel(label, modal);
      if (inp) {
        if (t === CONFIG.dateFromLabel && !fromInput) {
          fromInput = inp;
          log(`  Paired "${CONFIG.dateFromLabel}" → value="${inp.value}"`);
        } else if (t === CONFIG.dateToLabel && !toInput) {
          toInput = inp;
          log(`  Paired "${CONFIG.dateToLabel}" → value="${inp.value}"`);
        }
      }
    }

    if (fromInput && toInput && fromInput !== toInput) {
      return { fromInput, toInput };
    }

    // --- Fallback: positional (1st date input = od, 2nd = do) ---
    log("  Falling back to positional input detection");
    const allInputs = Array.from(modal.querySelectorAll(INPUT_SEL));
    const dateInputs = allInputs.filter((inp) => {
      const val = inp.value || "";
      return isDateLikeValue(val);
    });

    // If no inputs have date values yet, include all non-button text inputs
    const candidates = dateInputs.length >= 2 ? dateInputs : allInputs.filter((inp) => {
      const t = inp.type || "text";
      return t === "text" || t === "date";
    });

    log(`  Positional candidates: ${candidates.length} inputs`);
    candidates.forEach((inp, i) => log(`    [${i}] value="${inp.value}" placeholder="${inp.placeholder}"`));

    if (candidates.length >= 2) {
      return { fromInput: candidates[0], toInput: candidates[1] };
    }

    return { fromInput: null, toInput: null };
  }

  function findConfirmButton(modal) {
    return findElementByText(modal, "button, [role='button']", CONFIG.confirmButtonText);
  }

  async function updateSingleComponent(componentInfo, dateFromIso, dateToIso, index, total) {
    const { wrapper } = componentInfo;
    const sectionHeader =
      wrapper.querySelector("[class*='header'] span, h2, h3, h4")?.textContent?.trim() || `#${index + 1}`;
    log(`Processing component ${index + 1}/${total}: ${sectionHeader}`);
    updateStatus(`Zpracovávám ${index + 1}/${total}: ${sectionHeader}...`, "working");

    wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(400);

    const filterBtn = findFilterButton(wrapper);
    if (!filterBtn) {
      throw new Error(`Nepodařilo se najít tlačítko filtru pro komponentu "${sectionHeader}"`);
    }

    let modal;

    // --- Attempt 1: native .click() ---
    log("  Click attempt 1: element.click()...");
    filterBtn.click();
    await sleep(CONFIG.timings.afterFilterClick);
    modal = findModal();

    // --- Attempt 2: simulateClick with page-context events ---
    if (!modal) {
      log("  Click attempt 2: simulateClick (pointer+mouse events)...");
      simulateClick(filterBtn);
      await sleep(CONFIG.timings.afterFilterClick);
      modal = findModal();
    }

    // --- Attempt 3: React fiber onClick ---
    if (!modal) {
      log("  Click attempt 3: React fiber onClick...");
      const clicked = reactClick(filterBtn);
      if (clicked) {
        await sleep(CONFIG.timings.afterFilterClick);
        modal = findModal();
      }
    }

    // --- Attempt 4: click the icon child element inside the button ---
    if (!modal) {
      const iconChild = filterBtn.querySelector("span, i, svg, [class*='icon']");
      if (iconChild) {
        log("  Click attempt 4: clicking icon child element...");
        iconChild.click();
        await sleep(CONFIG.timings.afterFilterClick);
        modal = findModal();
      }
    }

    if (!modal) {
      // Wait a bit longer, maybe animation is slow
      log("  Waiting extra 3s for modal...");
      try {
        modal = await waitForElement(findModal, 3000);
      } catch {
        throw new Error(`Modal se neotevřel pro komponentu "${sectionHeader}". Žádná z klikovacích metod nezabrala.`);
      }
    }

    log("  Modal opened successfully");

    const { fromInput: dateFromInput, toInput: dateToInput } = findBothDateInputs(modal);

    if (!dateFromInput) {
      throw new Error(`Nepodařilo se najít input "${CONFIG.dateFromLabel}" v modálu`);
    }
    if (!dateToInput) {
      throw new Error(`Nepodařilo se najít input "${CONFIG.dateToLabel}" v modálu`);
    }
    if (dateFromInput === dateToInput) {
      throw new Error(`Oba datumy ukazují na stejný input - nelze rozlišit Období od/do`);
    }

    log(`  Setting dateFrom: ${dateFromIso} (current: "${dateFromInput.value}")`);
    await setDatePickerValue(dateFromInput, dateFromIso);
    await sleep(CONFIG.timings.afterDateSet);

    log(`  Setting dateTo: ${dateToIso} (current: "${dateToInput.value}")`);
    await setDatePickerValue(dateToInput, dateToIso);
    await sleep(CONFIG.timings.afterDateSet);

    const confirmBtn = findConfirmButton(modal);
    if (!confirmBtn) {
      throw new Error(`Nepodařilo se najít tlačítko "${CONFIG.confirmButtonText}" v modálu`);
    }

    log("  Clicking confirm...");
    confirmBtn.click();
    await sleep(500);
    if (findModal()) {
      simulateClick(confirmBtn);
      await sleep(500);
    }
    if (findModal()) {
      reactClick(confirmBtn);
    }
    await sleep(CONFIG.timings.afterConfirm);

    try {
      await waitForNoElement(findModal);
    } catch {
      warn("  Modal se možná nezavřel včas, pokračuji...");
    }

    log(`  Component ${index + 1} done`);
  }

  async function applyToAll(dateFromIso, dateToIso) {
    log(`Applying dates: ${dateFromIso} – ${dateToIso}`);

    const components = findSfcComponents();
    if (components.length === 0) {
      updateStatus("Nenalezeny žádné SfcSummary komponenty!", "error");
      return;
    }

    updateStatus(`Nalezeno ${components.length} komponent, začínám...`, "working");
    setApplyEnabled(false);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < components.length; i++) {
      try {
        await updateSingleComponent(components[i], dateFromIso, dateToIso, i, components.length);
        successCount++;
      } catch (err) {
        errorCount++;
        warn(`Error on component ${i + 1}:`, err.message);
        updateStatus(`Chyba u komponenty ${i + 1}: ${err.message}`, "error");
        await sleep(1000);

        const modal = findModal();
        if (modal) {
          const cancelBtn = findElementByText(modal, "button, [role='button']", "Zrušit");
          if (cancelBtn) {
            cancelBtn.click();
            await sleep(500);
            if (findModal()) simulateClick(cancelBtn);
            await sleep(CONFIG.timings.afterConfirm);
          }
        }
      }
    }

    if (errorCount === 0) {
      updateStatus(`Hotovo! Aktualizováno ${successCount} komponent.`, "success");
    } else {
      updateStatus(
        `Dokončeno: ${successCount} OK, ${errorCount} chyb.`,
        errorCount > 0 ? "error" : "success"
      );
    }
    setApplyEnabled(true);
  }

  // ─── UI ────────────────────────────────────────────────────────────────────

  let statusEl;
  let applyBtn;

  function updateStatus(text, type = "") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "sfc-status" + (type ? ` sfc-${type}` : "");
  }

  function setApplyEnabled(enabled) {
    if (applyBtn) applyBtn.disabled = !enabled;
  }

  function getDefaultDateFrom() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  function getDefaultDateTo() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  function injectUI() {
    const style = document.createElement("style");
    style.textContent = STYLES;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "sfc-date-sync-bar";

    bar.innerHTML = `
      <span class="sfc-label">SFC Date Sync</span>
      <div class="sfc-field-group">
        <span class="sfc-field-label">Období od:</span>
        <input type="date" id="sfc-date-from" value="${getDefaultDateFrom()}">
      </div>
      <div class="sfc-field-group">
        <span class="sfc-field-label">Období do:</span>
        <input type="date" id="sfc-date-to" value="${getDefaultDateTo()}">
      </div>
      <button class="sfc-btn sfc-btn-apply" id="sfc-apply-btn">Aplikovat na v\u0161echny</button>
      <span class="sfc-status" id="sfc-status"></span>
      <button class="sfc-btn sfc-btn-close" id="sfc-close-btn" title="Minimalizovat / Zobrazit">\u2015</button>
    `;

    document.body.prepend(bar);

    statusEl = document.getElementById("sfc-status");
    applyBtn = document.getElementById("sfc-apply-btn");

    applyBtn.addEventListener("click", () => {
      const dateFrom = document.getElementById("sfc-date-from").value;
      const dateTo = document.getElementById("sfc-date-to").value;

      if (!dateFrom || !dateTo) {
        updateStatus("Zadejte oba datumy!", "error");
        return;
      }
      if (dateFrom > dateTo) {
        updateStatus("'Období od' musí být před 'Období do'!", "error");
        return;
      }

      applyToAll(dateFrom, dateTo);
    });

    document.getElementById("sfc-close-btn").addEventListener("click", () => {
      bar.classList.toggle("sfc-minimized");
    });

    document.body.style.marginTop = "44px";

    log("UI injected");
    updateStatus("Připraveno.");
  }

  // ─── DIAGNOSTICS ─────────────────────────────────────────────────────────

  function dumpDebugInfo() {
    console.group("[SfcDateSync] Diagnostics");

    const components = findSfcComponents();
    console.log(`Found ${components.length} SfcSummary components`);

    components.forEach((comp, i) => {
      console.group(`Component ${i + 1}`);
      const sectionHeader =
        comp.wrapper.querySelector("h2, h3, h4")?.textContent?.trim() ||
        "unknown section";
      console.log("Section:", sectionHeader);
      console.log("Wrapper element:", comp.wrapper);
      console.log("Heading element:", comp.heading);

      const filterBtn = findFilterButton(comp.wrapper);
      console.log("Filter button:", filterBtn);
      if (filterBtn) {
        console.log("  - tagName:", filterBtn.tagName);
        console.log("  - className:", filterBtn.className);
        console.log("  - title:", filterBtn.getAttribute("title"));
        console.log("  - aria-label:", filterBtn.getAttribute("aria-label"));
        console.log("  - innerHTML (first 200):", filterBtn.innerHTML.substring(0, 200));
      }

      const allBtns = comp.wrapper.querySelectorAll("button, [role='button']");
      console.log(`All buttons in wrapper: ${allBtns.length}`);
      allBtns.forEach((btn, j) => {
        const classes = btn.className?.toString() || "";
        const svg = btn.querySelector("svg");
        console.log(
          `  [${j}] text="${btn.textContent.trim().substring(0, 20)}" ` +
          `class="${classes.substring(0, 60)}" ` +
          `hasSvg=${!!svg} title="${btn.getAttribute("title") || ""}"`,
          btn
        );
      });

      console.groupEnd();
    });

    const modal = findModal();
    if (modal) {
      console.group("Active Modal");
      console.log("Modal element:", modal);
      const inputs = modal.querySelectorAll("input");
      console.log(`Inputs in modal: ${inputs.length}`);
      inputs.forEach((inp, i) => {
        const reactProps = getReactProps(inp);
        const hasOnChange = !!findReactOnChange(inp);
        console.log(
          `  [${i}] type="${inp.type}" value="${inp.value}" ` +
          `placeholder="${inp.placeholder}" name="${inp.name}" ` +
          `hasReactProps=${!!reactProps} hasOnChange=${hasOnChange}`,
          inp
        );
      });

      const { fromInput, toInput } = findBothDateInputs(modal);
      console.log("findBothDateInputs result:");
      console.log("  dateFromInput:", fromInput, "value:", fromInput?.value);
      console.log("  dateToInput:", toInput, "value:", toInput?.value);
      console.log("  same element?", fromInput === toInput);
      console.groupEnd();
    } else {
      console.log("No active modal found (open a filter dialog first, then run debug again)");
    }

    console.groupEnd();
    return "Debug info logged. Check the console groups above.";
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────

  function init() {
    log("Initializing on page:", location.href);
    if (document.getElementById("sfc-date-sync-bar")) {
      log("Already initialized, skipping.");
      return;
    }
    injectUI();

    unsafeWindow.sfcDateSync = {
      debug: dumpDebugInfo,
      apply: (fromIso, toIso) => applyToAll(fromIso, toIso),
      findComponents: findSfcComponents,
      findModal: findModal,
      config: CONFIG,
    };
    log("Debug API available: sfcDateSync.debug(), sfcDateSync.apply('2024-11-01','2024-11-30')");
  }

  if (document.readyState === "complete") {
    setTimeout(init, 1500);
  } else {
    window.addEventListener("load", () => setTimeout(init, 1500));
  }
})();
