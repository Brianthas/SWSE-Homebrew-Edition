/**
 * A minimal, bounded/scrollable replacement for a plain `<input list="...">` native
 * `<datalist>` popup - Chromium (and every other browser) renders that popup as native OS UI
 * with no CSS hooks at all, so a long option list (e.g. the ~160-entry known-attribute-key
 * list on the Changes/Modes tab) can't be height-capped or given a scrollbar. This renders a
 * plain, fully-stylable `<ul>` instead.
 *
 * One dropdown element is created lazily and shared across every bound input on the page -
 * only one can ever be open at a time, so there's no reason to allocate (and have to clean up)
 * a separate element per input, per render.
 */

let sharedDropdown = null;
let outsideClickBound = false;

function getSharedDropdown() {
    if (sharedDropdown && document.body.contains(sharedDropdown)) return sharedDropdown;

    sharedDropdown = document.createElement("ul");
    sharedDropdown.className = "swse-autocomplete-dropdown";
    sharedDropdown.style.display = "none";
    document.body.appendChild(sharedDropdown);

    if (!outsideClickBound) {
        outsideClickBound = true;
        document.addEventListener("mousedown", (ev) => {
            if (sharedDropdown.style.display === "none") return;
            if (sharedDropdown.contains(ev.target) || ev.target === sharedDropdown._activeInput) return;
            hideDropdown();
        });
    }

    return sharedDropdown;
}

function hideDropdown() {
    if (sharedDropdown) sharedDropdown.style.display = "none";
}

function highlight(dropdown, index) {
    const items = dropdown.querySelectorAll("li");
    items.forEach((li, i) => li.classList.toggle("active", i === index));
    dropdown._activeIndex = index;
    items[index]?.scrollIntoView({block: "nearest"});
}

function selectValue(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("change", {bubbles: true}));
    hideDropdown();
}

function showOptions(input, options) {
    const dropdown = getSharedDropdown();
    const query = input.value.trim().toLowerCase();
    const matches = (query ? options.filter(opt => opt.toLowerCase().includes(query)) : options).slice(0, 150);

    if (matches.length === 0) {
        hideDropdown();
        return;
    }

    dropdown.innerHTML = matches.map(opt => `<li data-value="${opt}">${opt}</li>`).join("");
    dropdown._activeInput = input;
    dropdown._activeIndex = -1;

    const rect = input.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom}px`;
    dropdown.style.width = `${Math.max(rect.width, 180)}px`;
    dropdown.style.display = "block";

    dropdown.onmousedown = (ev) => {
        const li = ev.target.closest("li");
        if (!li) return;
        ev.preventDefault();
        selectValue(input, li.dataset.value);
    };
}

/**
 * Wires the bounded/scrollable autocomplete behavior onto every element matching `selector`
 * within `root` - accepts either a raw element (ApplicationV2's `this.element`) or a jQuery
 * object (classic Application's `html` param), matching whichever sheet framework calls it.
 *
 * @param {HTMLElement|jQuery} root
 * @param {string} selector
 * @param {string[]} options - the full candidate list; filtered client-side per keystroke.
 */
export function bindKeyAutocomplete(root, selector, options) {
    const rootEl = root?.jquery ? root[0] : root;
    if (!rootEl) return;

    rootEl.querySelectorAll(selector).forEach((input) => {
        input.addEventListener("input", () => showOptions(input, options));
        input.addEventListener("focus", () => showOptions(input, options));

        input.addEventListener("keydown", (ev) => {
            const dropdown = sharedDropdown;
            const isOpen = dropdown && dropdown.style.display !== "none" && dropdown._activeInput === input;

            if (ev.key === "Escape") {
                if (isOpen) {
                    ev.preventDefault();
                    hideDropdown();
                }
                return;
            }
            if (!isOpen) return;

            const items = dropdown.querySelectorAll("li");
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                highlight(dropdown, Math.min((dropdown._activeIndex ?? -1) + 1, items.length - 1));
            } else if (ev.key === "ArrowUp") {
                ev.preventDefault();
                highlight(dropdown, Math.max((dropdown._activeIndex ?? -1) - 1, 0));
            } else if (ev.key === "Enter" && dropdown._activeIndex > -1) {
                ev.preventDefault();
                selectValue(input, items[dropdown._activeIndex].dataset.value);
            }
        });
    });
}
