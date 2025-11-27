const formatNumber = (num) => {
    if (num === null || isNaN(num)) return 'N/A';
    return num.toLocaleString();
};

const showLoading = (isLoading) => {
    const el = document.getElementById('loading-indicator');
    if (!el) return;
    if (isLoading) el.classList.remove('hidden');
    else el.classList.add('hidden');
};

const friendlyKeyToName = (key) => {
    // Convert HULL_DATA to "Hull", KEEL_DATA to "Keel", etc.
    const map = {
        HULL_DATA: 'Hull',
        KEEL_DATA: 'Keel',
        HELM_DATA: 'Helm',
        KEEP_DATA: 'Keep',
        SAIL_DATA: 'Sail'
    };
    return map[key] || key;
};

const buildShipChips = (ships, defaultShipId) => {
    const container = document.getElementById('ship-chips');
    if (!container) return;
    container.innerHTML = '';

    // If no default ship passed, pick first available
    if (!defaultShipId && Array.isArray(ships) && ships.length) defaultShipId = ships[0].id;

    ships.forEach(ship => {
        const button = document.createElement('button');
        button.className = `ship-chip bg-gray-600 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-200`;
        button.textContent = ship.name;
        button.dataset.ship = ship.id;
        // set default visually and in app state
        if (ship.id === defaultShipId) {
            button.classList.remove('bg-gray-600');
            button.classList.add('bg-indigo-500');
        }
        button.addEventListener('click', () => {
            document.querySelectorAll('.ship-chip').forEach(b => {
                b.classList.remove('bg-indigo-500');
                b.classList.add('bg-gray-600');
            });
            button.classList.remove('bg-gray-600');
            button.classList.add('bg-indigo-500');
            const title = document.getElementById('input-title');
            if (title) title.textContent = `${ship.name} Configuration`;
            window.appState.selectedShipId = ship.id;
            // Rebuild selectors (with current ship context) so the available options are restricted
            // according to the selected ship type (e.g., Raft uses planks only; Skiff uses regular keel; Sloop uses large keel).
            if (window.appState && window.appState.shipData) {
                buildComponentSelectors(window.appState.shipData.ComponentDefinitions);
                buildFacilitySelectors(window.appState.shipData.FacilityDefinitions, 4);
            }
            updateResults();
        });
        container.appendChild(button);
    });
};

const buildComponentSelectors = (componentDefinitions) => {
    const container = document.getElementById('component-tiers');
    if (!container) return;
    container.innerHTML = '';

    const shipId = window.appState && window.appState.selectedShipId;

    // decide if an option is allowed for this ship
    const isPartAllowedForShip = (shipId, compKey, tier, part) => {
        if (!shipId) return true;
        const sid = String(shipId);
        const material = (part.raw_material || '').toLowerCase();

        // Raft: only plank-based components allowed
        if (sid === 'Raft') {
            return material.includes('plank');
        }
        // Skiff / Sloop: specific keel restrictions
        if (compKey === 'KEEL_DATA') {
            if (sid === 'Skiff') return (tier.type || '').toLowerCase() === 'regular';
            if (sid === 'Sloop') return (tier.type || '').toLowerCase() === 'large';
        }
        return true;
    };

    Object.keys(componentDefinitions).forEach(compKey => {
        // Hide the keel selector for Raft ships entirely
        if (compKey === 'KEEL_DATA' && shipId === 'Raft') {
            if (window.appState && window.appState.selectedComponents) {
                window.appState.selectedComponents[compKey] = null;
            }
            return; // skip adding this component row completely
        }
        const friendly = friendlyKeyToName(compKey);
        const wrapper = document.createElement('div');
        wrapper.className = 'component-row';

        const label = document.createElement('label');
        label.className = 'block text-gray-200 font-medium mb-1';
        label.textContent = friendly;

        const select = document.createElement('select');
        select.className = 'component-select w-full p-2 bg-gray-800 text-gray-100 rounded';
        select.dataset.componentKey = compKey;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.text = `-- Select ${friendly} --`;
        select.appendChild(defaultOption);

        // Each component type in JSON has tiers (Regular/Large)
        const tiers = componentDefinitions[compKey] || [];
        tiers.forEach((tier, tierIndex) => {
            const qtyPerPart = tier.qty_per_part || 0;
            const tierTotalParts = tier.total_parts || 0;

            (tier.parts || []).forEach((part, partIndex) => {
                if (!isPartAllowedForShip(shipId, compKey, tier, part)) return; // skip options not allowed
                const option = document.createElement('option');
                option.value = `${compKey}|${tierIndex}|${partIndex}`;
                option.text = `${tier.type}: ${part.name} (S:${part.level_sailing || 0} C:${part.level_con || part.level_sailing || 0})`;
                option.dataset.rawMaterial = part.raw_material || '';
                option.dataset.tierQtyPerPart = qtyPerPart;
                option.dataset.tierTotalParts = tierTotalParts;
                option.dataset.sailing = part.level_sailing || 0;
                option.dataset.con = part.level_con || part.level_sailing || 0;
                select.appendChild(option);
            });
        });

        // Attempt to restore a previous selection if this comp had one; otherwise select the first valid option
        select.addEventListener('change', () => {
            window.appState.selectedComponents[compKey] = select.value || null;
            updateResults();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        container.appendChild(wrapper);

        // Try to restore previous selection (if it's still allowed)
        const prevSelection = window.appState && window.appState.selectedComponents ? window.appState.selectedComponents[compKey] : null;
        let restored = false;
        if (prevSelection) {
            for (let i=0; i<select.options.length; i++) {
                if (select.options[i].value === prevSelection) {
                    select.selectedIndex = i;
                    restored = true;
                    break;
                }
            }
        }
        // If no restored selection and we have at least one real option, select that
        if (!restored && select.options && select.options.length > 1) {
            select.selectedIndex = 1;
            window.appState.selectedComponents[compKey] = select.value;
            select.dispatchEvent(new Event('change'));
        } else if (!restored) {
            window.appState.selectedComponents[compKey] = null;
        }
    });

    // call one update after setting defaults
    updateResults();
};

const buildFacilitySelectors = (facilityDefinitions, count = 4) => {
    const container = document.getElementById('facility-tiers');
    if (!container) return;
    container.innerHTML = '';
    const shipId = window.appState && window.appState.selectedShipId;

    const isFacilityAllowedForShip = (shipId, fac) => {
        if (!shipId) return true;
        const sid = String(shipId);
        const material = (fac.raw_material || '').toLowerCase();
        if (sid === 'Raft') return material.includes('plank');
        return true;
    };
    for (let i = 0; i < count; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'facility-row';

        const label = document.createElement('label');
        label.className = 'block text-gray-200 font-medium mb-1';
        label.textContent = `Facility Hotspot ${i + 1}`;

        const select = document.createElement('select');
        select.className = 'component-select w-full p-2 bg-gray-800 text-gray-100 rounded';
        select.dataset.slot = i;

        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.text = '-- None --';
        select.appendChild(noneOption);

        (facilityDefinitions || []).forEach((fac, idx) => {
            if (!isFacilityAllowedForShip(shipId, fac)) return; // skip facilities not allowed for this ship
            const option = document.createElement('option');
            option.value = `${idx}`;
            option.text = `${fac.label} (S:${fac.level_sailing}, C:${fac.level_con})`;
            option.dataset.rawMaterial = fac.raw_material || '';
            option.dataset.qtyPerPart = fac.qty_per_part || 0;
            option.dataset.totalParts = fac.total_parts || 0;
            option.dataset.sailing = fac.level_sailing || 0;
            option.dataset.con = fac.level_con || 0;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            const val = select.value;
            if (val === '') window.appState.selectedFacilities[i] = null;
            else window.appState.selectedFacilities[i] = parseInt(val, 10);
            updateResults();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        container.appendChild(wrapper);

        // default to None initially; try to restore previous choice if it's still allowed
        const prev = (window.appState && window.appState.selectedFacilities) ? window.appState.selectedFacilities[i] : null;
        if (prev !== null && prev !== undefined) {
            // only restore if the facility index was kept as an option (we used the original idx values for option.value)
            const allowedValues = Array.from(select.options).map(o => o.value);
            if (allowedValues.includes(String(prev))) {
                select.value = String(prev);
                window.appState.selectedFacilities[i] = prev;
            } else {
                window.appState.selectedFacilities[i] = null;
            }
        } else {
            window.appState.selectedFacilities[i] = null;
        }
    }
};

const computeTotals = (data) => {
    const result = {
        selectedShip: null,
        components: {},
        facilities: [],
        totalsByMaterial: {},
        maxSailing: 0,
        maxCon: 0
    };

    const ship = data.ShipStats.find(s => s.id === window.appState.selectedShipId) || data.ShipStats[0];
    result.selectedShip = ship;
    result.maxSailing = ship.level_sailing || 0;
    result.maxCon = ship.level_con || 0;

    // Gather components
    Object.keys(data.ComponentDefinitions).forEach(compKey => {
        const selection = window.appState.selectedComponents[compKey];
        if (!selection) return;
        const [ck, tierIndexStr, partIndexStr] = selection.split('|');
        const tierIndex = parseInt(tierIndexStr, 10);
        const partIndex = parseInt(partIndexStr, 10);
        const tier = data.ComponentDefinitions[compKey][tierIndex];
        const part = tier.parts[partIndex];

        const qtyPerPart = tier.qty_per_part || 0;
        const totalParts = tier.total_parts || 0;
        const totalMaterialAmount = qtyPerPart * totalParts;

        // Update levels
        const partSailing = part.level_sailing || 0;
        const partCon = part.level_con || partSailing || 0;
        result.maxSailing = Math.max(result.maxSailing, partSailing);
        result.maxCon = Math.max(result.maxCon, partCon);

        const raw = part.raw_material || 'Unknown';
        result.totalsByMaterial[raw] = (result.totalsByMaterial[raw] || 0) + totalMaterialAmount;

        result.components[compKey] = {
            tier: tier.type,
            name: part.name,
            raw_material: raw,
            total_amount: totalMaterialAmount,
            sailing: partSailing,
            con: partCon
        };
    });

    // Gather facilities
    window.appState.selectedFacilities.forEach(slot => {
        if (slot === null || typeof slot === 'undefined') {
            result.facilities.push(null);
            return;
        }
        const fac = data.FacilityDefinitions[slot];
        if (!fac) return result.facilities.push(null);

        const qty = fac.qty_per_part || 0;
        const parts = fac.total_parts || 0;
        const totalMaterialAmount = qty * parts;
        result.maxSailing = Math.max(result.maxSailing, fac.level_sailing || 0);
        result.maxCon = Math.max(result.maxCon, fac.level_con || 0);

        const raw = fac.raw_material || 'Unknown';
        result.totalsByMaterial[raw] = (result.totalsByMaterial[raw] || 0) + totalMaterialAmount;

        result.facilities.push({
            name: fac.name,
            label: fac.label,
            raw_material: raw,
            total_amount: totalMaterialAmount,
            sailing: fac.level_sailing || 0,
            con: fac.level_con || 0
        });
    });

    return result;
};

const updateResults = () => {
    const data = window.appState.shipData;
    if (!data) return;
    const res = computeTotals(data);

    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    const appendRow = (label, value) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-4 py-2 text-gray-200">${label}</td><td class="px-4 py-2 text-gray-100">${value}</td>`;
        tbody.appendChild(tr);
    };

    appendRow('Ship', `${res.selectedShip.name} (Speed: ${res.selectedShip.speed}, HP: ${res.selectedShip.hp})`);
    appendRow('Required Sailing Level', res.maxSailing);
    appendRow('Required Construction Level', res.maxCon);

    // Separator
    const sep = document.createElement('tr');
    sep.className = 'separator-row';
    sep.innerHTML = `<td colspan="2">Selected Components</td>`;
    tbody.appendChild(sep);

    Object.keys(res.components).forEach(compKey => {
        const comp = res.components[compKey];
        appendRow(friendlyKeyToName(compKey), `${comp.tier}: ${comp.name} — ${formatNumber(comp.total_amount)} ${comp.raw_material}`);
    });

    const sep2 = document.createElement('tr');
    sep2.className = 'separator-row';
    sep2.innerHTML = `<td colspan="2">Selected Facilities</td>`;
    tbody.appendChild(sep2);
    (res.facilities || []).forEach((f, idx) => {
        if (!f) appendRow(`Facility slot ${idx + 1}`, `None`);
        else appendRow(`Facility slot ${idx + 1}`, `${f.label} — ${formatNumber(f.total_amount)} ${f.raw_material}`);
    });

    // Totals by material
    const sep3 = document.createElement('tr');
    sep3.className = 'separator-row';
    sep3.innerHTML = `<td colspan="2">Total Materials Required</td>`;
    tbody.appendChild(sep3);

    if (Object.keys(res.totalsByMaterial).length === 0) {
        appendRow('Materials', 'None selected');
    } else {
        Object.entries(res.totalsByMaterial).forEach(([mat, amt]) => {
            appendRow(mat, formatNumber(amt));
        });
    }

    // show results area if hidden
    const resultsArea = document.getElementById('resultsArea');
    if (resultsArea) resultsArea.classList.remove('hidden');
};

const initApp = async () => {
    window.appState = {
        shipData: null,
        selectedShipId: null,
        selectedComponents: {}, // Map compKey -> selection value
        selectedFacilities: [null, null, null, null],
    };

    showLoading(true);
    try {
        const response = await fetch('ship_data.json');
        if (!response.ok) throw new Error('Failed to fetch ship data');
        const data = await response.json();
        console.log('Ship data loaded', data);
        window.appState.shipData = data;

        // default ship
        const defaultShipId = (data.ShipStats && data.ShipStats[0] && data.ShipStats[0].id) || null;
        window.appState.selectedShipId = defaultShipId;

        buildShipChips(data.ShipStats, defaultShipId);
        buildComponentSelectors(data.ComponentDefinitions);
        buildFacilitySelectors(data.FacilityDefinitions, 4);

        // set input title
        const title = document.getElementById('input-title');
        if (title && defaultShipId) {
            const shipEntry = data.ShipStats.find(s => s.id === defaultShipId);
            if (shipEntry) title.textContent = `${shipEntry.name} Configuration`;
            else title.textContent = `${defaultShipId} Configuration`;
        }

        updateResults();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('resultsBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="2" class="text-red-400 px-4 py-4">Failed to load ship data.</td></tr>`;
        }
    } finally {
        showLoading(false);
    }
};

// add backward-compatible global entrypoint expected by older code and scripts that call "initializeApp"
// Accepts parsed JSON-like ship data or falls back to fetching JSON if called with no argument.
window.initializeApp = (parsedShipData = null) => {
    if (parsedShipData) {
        if (!window.appState) {
            window.appState = {
                shipData: parsedShipData,
                selectedShipId: (parsedShipData.ShipStats && parsedShipData.ShipStats[0] && parsedShipData.ShipStats[0].id) || null,
                selectedComponents: {},
                selectedFacilities: [null, null, null, null],
            };
        } else {
            window.appState.shipData = parsedShipData;
            if (!window.appState.selectedShipId && parsedShipData.ShipStats && parsedShipData.ShipStats[0]) {
                window.appState.selectedShipId = parsedShipData.ShipStats[0].id;
            }
        }

        // build UI and populate
        buildShipChips(parsedShipData.ShipStats, window.appState.selectedShipId);
        buildComponentSelectors(parsedShipData.ComponentDefinitions);
        buildFacilitySelectors(parsedShipData.FacilityDefinitions, 4);
        updateResults();
        console.log('initializeApp: setup complete from provided ship data.');
    } else {
        // fallback: use initApp to fetch data from ship_data.json
        initApp();
    }
};

// lightweight alias for older callers that used loadShipData(parsedData)
window.loadShipData = (data) => {
    // If argument is an XML Document (older code parsed XML), try to convert to JSON-like object
    if (data && typeof data === 'object' && data.documentElement) {
        // simple XML -> JSON parsing: convert tags into structure expected
        try {
            const xmlDoc = data;
            // Very minimal conversion: if it's the XML schema you expect, adapt accordingly.
            // For safety, prefer callers to pass JSON — just forward the full XML raw as an error message for now.
            console.warn('loadShipData: Received XML Document — please pass parsed JSON if possible.');
            // We don't handle full XML parsing here; optionally parse it if needed.
            window.initializeApp(); // fallback to fetching JSON
            return;
        } catch (err) {
            console.error('loadShipData: XML parsing failed, falling back to fetch JSON', err);
            window.initializeApp();
            return;
        }
    }

    // assume JSON-like object (already parsed)
    if (data && data.ShipStats) {
        window.initializeApp(data);
    } else {
        // no data supplied — fetch automatically
        window.initializeApp();
    }
};

// expose initApp to global in case anything calls that name explicitly
window.initApp = initApp;

// on legacy pages or older scripts that invoked loadShipData immediately, ensure we can be called from global scope
console.debug('Ship builder script loaded, initApp & initializeApp available.');