// ─── State ────────────────────────────────────────────────────────────────────
let tempChart;

// ─── Main 3-second snapshot poll ─────────────────────────────────────────────
async function pollSnapshot() {
    try {
        const res = await fetch("http://localhost:5000/snapshot");
        const s = await res.json();
        updateDashboard(s);
    } catch (err) {
        console.error("Snapshot fetch error:", err);
    }
}

function updateDashboard(s) {
    // ── Flow status ───────────────────────────────────────────────────────────
    const flowEl = document.getElementById("flow");
    if (flowEl) {
        flowEl.innerText = s.flow === "RUNNING" ? "✅ Flow Running"
                         : s.flow === "STOPPED"  ? "🛑 Flow Stopped"
                         : "⏳ Awaiting data...";
    }

    // ── Drop count ────────────────────────────────────────────────────────────
    const dropCountEl = document.getElementById("dropCount");
    if (dropCountEl) {
        dropCountEl.innerText = `💧 Drops Detected: ${s.totalDrops}`;
    }

    // ── Volume infused ────────────────────────────────────────────────────────
    const volumeEl = document.getElementById("volume");
    if (volumeEl) {
        volumeEl.innerText = `Volume Infused: ${s.totalVolume.toFixed(3)} mL`;
    }

    // ── Rate history ──────────────────────────────────────────────────────────
    const rateEl = document.getElementById("rateHistory");
    if (rateEl) {
        if (s.rateHistory && s.rateHistory.length > 0) {
            const fmt = s.rateHistory.map(r => r.toFixed(2)).join(" → ");
            rateEl.innerText = `[${fmt}] drops/sec  •  avg: ${s.avgDropsPerSec.toFixed(2)} drops/sec`;
        } else {
            rateEl.innerText = "Collecting rate data...";
        }
    }

    // ── Anomaly ───────────────────────────────────────────────────────────────
    const anomalyEl = document.getElementById("anomaly");
    if (anomalyEl) {
        if (s.anomaly) {
            anomalyEl.innerText = `⚠️ ${s.anomaly.type}: ${Number(s.anomaly.value).toFixed(2)} drops/sec (avg: ${s.anomaly.avg})`;
            anomalyEl.style.color = "#ff6b6b";
            anomalyEl.style.fontWeight = "bold";
        } else {
            anomalyEl.innerText = "✅ Flow normal";
            anomalyEl.style.color = "#51cf66";
            anomalyEl.style.fontWeight = "normal";
        }
    }

    // ── Time-remaining prediction (pure math — no ML model needed) ───────────
    const remainEl    = document.getElementById("remaining");
    const timeEl      = document.getElementById("timeRemaining");
    const bagVolInput = document.getElementById("bagVolume");

    if (remainEl && timeEl && s.avgMlPerSec > 0) {
        const bagVol        = parseFloat(bagVolInput ? bagVolInput.value : 500) || 500;
        const remainingVol  = Math.max(0, bagVol - s.totalVolume);
        const timeRemainMin = remainingVol / (s.avgMlPerSec * 60);

        remainEl.innerText = `📦 Remaining in bag: ${remainingVol.toFixed(2)} mL`;
        timeEl.innerText   = `⏱️ Time Remaining: ${timeRemainMin.toFixed(1)} min`;
    } else if (remainEl && s.avgMlPerSec === 0) {
        remainEl.innerText = "Waiting for flow data...";
        if (timeEl) timeEl.innerText = "⏱️ Time Remaining: --";
    }
}

// ─── HR / SPO2 controls ───────────────────────────────────────────────────────
async function setHR() {
    const hr = document.getElementById("hr").value;
    if (!hr) { alert("Please enter a heart rate value"); return; }
    try {
        await fetch("http://localhost:5000/heart", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ hr })
        });
        document.getElementById("hr").value = "";
    } catch (err) { console.error("HR error:", err); }
}

async function setSP() {
    const sp = document.getElementById("sp").value;
    if (!sp) { alert("Please enter a SPO2 value"); return; }
    try {
        await fetch("http://localhost:5000/spo2", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ sp })
        });
        document.getElementById("sp").value = "";
    } catch (err) { console.error("SPO2 error:", err); }
}

// ─── Start polling every 3 seconds ───────────────────────────────────────────
pollSnapshot();
setInterval(pollSnapshot, 3000);
