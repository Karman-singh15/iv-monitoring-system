const express = require("express")
const cors = require("cors")
const { exec } = require("child_process")
const fs = require("fs")
const path = require("path")

const { SerialPort } = require("serialport")
const { ReadlineParser } = require("@serialport/parser-readline")

const app = express()

app.use(cors())
app.use(express.json())

let flowStatus = "UNKNOWN"
let dropMessage = null
let rateHistory = [] // recent drop rates for anomaly detection
let totalDrops = 0
let totalVolume = 0   // ml
let lastDropTime = null
let totalActiveSec = 0    // accumulate only when flow is actively running
let lastSnapshotTime = Date.now()
let anomalyAlert = null
const MAX_HISTORY = 5

let port = null
const isSimulation = process.argv.includes('--simulate')

const parser = new ReadlineParser({ delimiter: "\n" })

if (!isSimulation) {
    port = new SerialPort({
        path: "/dev/cu.usbserial-A5069RR4",
        baudRate: 9600
    })
    port.pipe(parser)
} else {
    console.log("🛠️  SIMULATION MODE — emitting a fake drop every 1.5 sec")
    flowStatus = "RUNNING"
    setTimeout(() => parser.emit("data", "FLOW_RUNNING"), 500)
    setInterval(() => parser.emit("data", "Drop detected"), 1500)
}


parser.on("data", (line) => {

    console.log("Arduino:", line)

    // basic flow state handling
    if (line.includes("FLOW_STOPPED")) {
        flowStatus = "STOPPED"
        anomalyAlert = null
    }

    if (line.includes("FLOW_RUNNING")) {
        flowStatus = "RUNNING"
    }

    // look for drop notification (Arduino sends plain "Drop detected")
    if (line.toLowerCase().includes("drop")) {
        dropMessage = line.trim()

        // Calculate rate from time between drops
        const now = Date.now()
        if (lastDropTime !== null) {
            const deltaSec = (now - lastDropTime) / 1000.0
            if (deltaSec > 0.05) { // debounce: ignore noise faster than 50ms
                updateRateHistory(1.0 / deltaSec)
            }
        }
        lastDropTime = now
        totalDrops++
        const dropVol = 0.045 + Math.random() * 0.010  // random 0.045–0.055 ml per drop
        totalVolume += dropVol
        console.log(`💧 totalDrops: ${totalDrops}, dropVol: ${dropVol.toFixed(4)} ml, total: ${totalVolume.toFixed(3)} ml`)
        checkAnomalies()
    }

})

// Update rate history buffer
function updateRateHistory(rate) {
    rateHistory.push(rate)
    if (rateHistory.length > MAX_HISTORY) {
        rateHistory.shift()
    }
    console.log(`📊 Rate history: [${rateHistory.join(", ")}]`)
}

// Check for anomalies
function checkAnomalies() {
    if (rateHistory.length < 3) return

    const avg = rateHistory.reduce((a, b) => a + b) / rateHistory.length
    const current = rateHistory[rateHistory.length - 1]

    if (current > avg * 1.5) {
        anomalyAlert = { type: "HIGH_FLOW", value: current, avg: avg.toFixed(2) }
        console.log(`⚠️ HIGH FLOW DETECTED: ${current.toFixed(2)} vs avg ${avg.toFixed(2)}`)
    } else if (current < avg * 0.5 && current > 0) {
        anomalyAlert = { type: "LOW_FLOW", value: current, avg: avg.toFixed(2) }
        console.log(`⚠️ LOW FLOW/BLOCKAGE: ${current.toFixed(2)} vs avg ${avg.toFixed(2)}`)
    } else {
        anomalyAlert = null
    }
}

// ─── 3-second snapshot buffer ────────────────────────────────────────────────
// All raw data accumulates in real-time. Every 3s we freeze a snapshot.
// The frontend polls /snapshot every 3s so it always gets a stable, complete
// set of stats — no mid-cycle partial updates.

let snapshot = {
    flow: "UNKNOWN",
    totalDrops: 0,
    totalVolume: 0,
    avgDropsPerSec: 0,
    avgMlPerSec: 0,
    rateHistory: [],
    anomaly: null,
    lastUpdated: Date.now()
}

function buildSnapshot() {
    const avgDropsPerSec = rateHistory.length > 0
        ? rateHistory.reduce((a, b) => a + b) / rateHistory.length
        : 0

    const now = Date.now()
    const deltaSec = (now - lastSnapshotTime) / 1000
    lastSnapshotTime = now

    // Auto-detect flow status: if drops haven't changed in 3s, flow is stopped
    if (totalDrops > 0) {
        if (totalDrops === snapshot.totalDrops) {
            flowStatus = "STOPPED"
        } else {
            flowStatus = "RUNNING"
            totalActiveSec += deltaSec
        }
    }

    // Overall average mL/sec = total volume / active seconds
    const avgMlPerSec = totalActiveSec > 0 ? totalVolume / totalActiveSec : 0

    snapshot = {
        flow: flowStatus,
        totalDrops,
        totalVolume,
        avgDropsPerSec,
        avgMlPerSec,
        rateHistory: [...rateHistory],
        anomaly: anomalyAlert,
        lastUpdated: Date.now()
    }
    console.log(`📸 Snapshot: ${totalDrops} drops, ${totalVolume.toFixed(3)} ml, ${avgDropsPerSec.toFixed(2)} drops/s, flow: ${flowStatus}`)
}

// Freeze snapshot every 3 seconds
setInterval(buildSnapshot, 3000)

// ──────────────────────────────────────────────────────────────────────────────

// send HR
app.post("/heart", (req, res) => {
    const { hr } = req.body
    if (port) port.write(`HR${hr}\n`)
    res.json({ status: "sent" })
})

// send SPO2
app.post("/spo2", (req, res) => {
    const { sp } = req.body
    if (port) port.write(`SP${sp}\n`)
    res.json({ status: "sent" })
})

// Snapshot endpoint — returns the last 3-second frozen stats
app.get("/snapshot", (req, res) => {
    res.json(snapshot)
})

// get flow status (legacy — keep for backwards compatibility)
app.get("/status", (req, res) => {
    res.json({
        flow: flowStatus,
        drop: dropMessage,
        rateHistory: rateHistory,
        totalDrops: totalDrops,
        totalVolume: totalVolume,
        anomaly: anomalyAlert
    })
})



// ML prediction endpoint
app.post("/predict", (req, res) => {
    const { totalDrops: drops } = req.body

    if (rateHistory.length < MAX_HISTORY) {
        return res.status(400).json({
            error: "Not enough rate history",
            collected: rateHistory.length,
            needed: MAX_HISTORY
        })
    }

    // Prepare inputs: [r1, r2, r3, r4, r5, total_drops]
    const inputs = [...rateHistory, drops].join(" ")

    exec(`python3 ml/predict.py ${inputs}`, (error, stdout, stderr) => {
        if (error) {
            console.error("ML error:", stderr)
            return res.status(500).json({ error: "Prediction failed" })
        }

        const remaining = parseFloat(stdout.trim())

        res.json({
            remaining: remaining,
            rateHistory: rateHistory,
            totalDrops: drops,
            anomaly: anomalyAlert
        })
    })
})

// Log data for self-learning (retraining)
app.post("/log-data", (req, res) => {
    const { rateHistory: history, totalDrops: drops, remaining } = req.body

    if (!Array.isArray(history) || history.length !== MAX_HISTORY) {
        return res.status(400).json({ error: "Invalid rate history" })
    }

    const logEntry = {
        timestamp: new Date().toISOString(),
        rateHistory: history,
        totalDrops: drops,
        remaining: remaining
    }

    // Append to log file
    const logFile = path.join(__dirname, "ml/training_log.jsonl")
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n")

    res.json({ status: "logged" })
})

app.listen(5000, () => {
    console.log("Server running on port 5000")
    console.log("🤖 ML features enabled")
    console.log("📝 Data logging for self-learning active")
})