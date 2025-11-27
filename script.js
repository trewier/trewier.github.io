const parseComponentTier = (tierElement) => {
    const parts = [];

    // Allow Tier-level defaults (qty_per_part, total_parts) to reduce repetition in XML
    const tierQtyPerPart = parseInt(tierElement.getAttribute('qty_per_part') || '0');
    const tierTotalParts = parseInt(tierElement.getAttribute('total_parts') || '0');

    tierElement.querySelectorAll('Part').forEach(partEl => {
        const levelSailing = parseInt(partEl.getAttribute('level_sailing')) || 0;
        const levelCon = parseInt(partEl.getAttribute('level_con') || levelSailing || '0');

        // Part-level values override Tier defaults if provided; otherwise fall back to tier defaults
        const qtyPerPart = parseInt(partEl.getAttribute('qty_per_part') || tierQtyPerPart || '0');
        const totalParts = parseInt(partEl.getAttribute('total_parts') || tierTotalParts || '0');

        parts.push({
            name: partEl.getAttribute('name'),
            level_sailing: levelSailing,
            level_con: levelCon,
            raw_material: partEl.getAttribute('raw_material'),
            qty_per_part: qtyPerPart,
            total_parts: totalParts,
        });
    });
    return parts;
};
const formatNumber = (num) => {
    if (num === null || isNaN(num)) return 'N/A';
    const absNum = Math.abs(num);
    let suffix = '';
    let displayNum = num;

    if (absNum >= 1000000) {
        displayNum = (num / 1000000).toFixed(2);
        suffix = 'M';
    } else if (absNum >= 1000) {
        displayNum = (num / 1000).toFixed(1);
        suffix = 'k';
    } else {
        return num.toLocaleString();
    }

    return displayNum + suffix + ' GP';
};

const showMessage = (msg) => {
    const msgBox = document.getElementById('messageBox');
    if (msg) {
        msgBox.textContent = msg;
        msgBox.classList.remove('hidden');
    } else {
        msgBox.classList.add('hidden');
    }
}


const calculateProfit = () => {
    const logPrice = parseFloat(document.getElementById('logPrice').value);
    const logCount = parseFloat(document.getElementById('logCount').value);
    const axeCost = parseFloat(document.getElementById('axeCost').value) || 0;
    const xpRate = parseFloat(document.getElementById('xpRate').value);

    if (isNaN(logPrice) || isNaN(logCount) || isNaN(xpRate) || logPrice <= 0 || logCount <= 0 || xpRate <= 0) {
        showMessage("Please enter valid positive numbers for all required fields.");
        document.getElementById('resultsArea').classList.add('hidden');
        return;
    }
    showMessage(null);

    const totalRevenue = logPrice * logCount;
    const netProfit = totalRevenue - axeCost;
    
    const xpPerLog = 25; 
    const totalXP = logCount * xpPerLog; 
    const hoursRequired = totalXP / xpRate;

    const results = [
        { metric: "Total Logs Cut", value: logCount.toLocaleString(), isGP: false },
        { metric: "Total Revenue", value: totalRevenue, isGP: true },
        { metric: "Total Expenses (Axe)", value: axeCost, isGP: true },
        { metric: "Net Profit (Total)", value: netProfit, isGP: true, color: netProfit >= 0 ? 'text-green-400' : 'text-red-400' },
        { metric: "Total XP Gained", value: totalXP.toLocaleString(), isGP: false },
        { metric: "Time Required (Hours)", value: hoursRequired.toFixed(2) + ' hours', isGP: false }
    ];

    const resultsBody = document.getElementById('resultsBody');
    resultsBody.innerHTML = ''; 

    results.forEach(res => {
        const row = document.createElement('tr');
        const valueText = res.isGP ? formatNumber(res.value) : res.value;

        row.innerHTML = `
            <td>${res.metric}</td>
            <td class="${res.color || 'text-primary'}">${valueText}</td>
        `;
        resultsBody.appendChild(row);
    });

    document.getElementById('resultsArea').classList.remove('hidden');
}

window.onload = () => {
    calculateProfit();
};