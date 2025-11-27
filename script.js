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
            updateResults();
        });
        container.appendChild(button);
    });
};

const buildComponentSelectors = (componentDefinitions) => {
    const container = document.getElementById('component-tiers');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(componentDefinitions).forEach(compKey => {
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

        // If any real option exists, preselect the first (after placeholder) so results populate
        select.addEventListener('change', () => {
            window.appState.selectedComponents[compKey] = select.value || null;
            updateResults();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        container.appendChild(wrapper);

        // Preselect first real option (if present)
        if (select.options && select.options.length > 1) {
            select.selectedIndex = 1; // choose first available option
            window.appState.selectedComponents[compKey] = select.value;
        } else {
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

        // default to None initially
        window.appState.selectedFacilities[i] = null;
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

window.addEventListener('DOMContentLoaded', initApp);