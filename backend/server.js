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

// Serve the frontend static files
app.use(express.static(path.join(__dirname, '../frontend')))

let flowStatus = "UNKNOWN"
let dropMessage = null
let rateHistory = [] // recent rate history for ML
let totalDrops = 0
let totalVolume = 0 // total volume infused (ml) assuming 20 drops/ml
let lastDropTime = null
let anomalyAlert = null
const MAX_HISTORY = 5

const isSimulation = process.argv.includes('--simulate')

let port;
const parser = new ReadlineParser({ delimiter: "\n" })

if (!isSimulation) {
 // Arduino serial
 port = new SerialPort({
  path: "/dev/cu.usbserial-A5069RR4",
  baudRate: 9600
 })
 port.pipe(parser)
} else {
 console.log("🛠️ Running in SIMULATION mode. Emitting fake drop data...")
 // Simulate flow messages and a drop every 1.5 seconds
 setTimeout(() => parser.emit("data", "FLOW_RUNNING"), 1000)
 setInterval(() => {
  parser.emit("data", "Drop detected")
 }, 1500)
}

parser.on("data",(line)=>{

 console.log("Arduino:",line)

 // basic flow state handling
 if(line.includes("FLOW_STOPPED")){
  flowStatus = "STOPPED"
  anomalyAlert = null
 }

 if(line.includes("FLOW_RUNNING")){
  flowStatus = "RUNNING"
 }

 // look for drop notification
 if(line.toLowerCase().includes("drop")){
  dropMessage = line.trim()
  
  const now = Date.now()
  if (lastDropTime) {
   // calculate time difference in seconds
   const deltaSec = (now - lastDropTime) / 1000.0
   if (deltaSec > 0) {
    const rate = 1.0 / deltaSec // drops per second
    updateRateHistory(rate)
   }
  }
  
  lastDropTime = now
  totalDrops++
  totalVolume = totalDrops / 20.0 // assuming 20 drops/ml
  
  checkAnomalies()
 }

})

// Update rate history buffer
function updateRateHistory(rate) {
 rateHistory.push(rate)
 if(rateHistory.length > MAX_HISTORY) {
  rateHistory.shift()
 }
 console.log(`📊 Rate history: [${rateHistory.join(", ")}]`)
}

// Check for anomalies
function checkAnomalies() {
 if(rateHistory.length < 3) return
 
 const avg = rateHistory.reduce((a,b) => a+b) / rateHistory.length
 const current = rateHistory[rateHistory.length - 1]
 
 if(current > avg * 1.5) {
  anomalyAlert = {type: "HIGH_FLOW", value: current, avg: avg.toFixed(2)}
  console.log(`⚠️ HIGH FLOW DETECTED: ${current.toFixed(2)} vs avg ${avg.toFixed(2)}`)
 } else if(current < avg * 0.5 && current > 0) {
  anomalyAlert = {type: "LOW_FLOW", value: current, avg: avg.toFixed(2)}
  console.log(`⚠️ LOW FLOW/BLOCKAGE: ${current.toFixed(2)} vs avg ${avg.toFixed(2)}`)
 } else {
  anomalyAlert = null
 }
}

// send HR
app.post("/heart",(req,res)=>{
 const {hr} = req.body
 if(port) port.write(`HR${hr}\n`)
 res.json({status:"sent"})
})

// send SPO2
app.post("/spo2",(req,res)=>{
 const {sp} = req.body
 if(port) port.write(`SP${sp}\n`)
 res.json({status:"sent"})
})

// get flow status and any drop message
app.get("/status",(req,res)=>{
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
 
 if(rateHistory.length < MAX_HISTORY) {
  return res.status(400).json({
   error: "Not enough rate history",
   collected: rateHistory.length,
   needed: MAX_HISTORY
  })
 }
 
 // Prepare inputs: [r1, r2, r3, r4, r5, total_drops]
 const inputs = [...rateHistory, drops].join(" ")
 
 exec(`python3 ml/predict.py ${inputs}`, (error, stdout, stderr) => {
  if(error) {
   console.error("ML error:", stderr)
   return res.status(500).json({error: "Prediction failed"})
  }
  
  const remaining = parseFloat(stdout.trim())
  
  // Calculate time remaining based on average current drop rate
  const avgRate = rateHistory.reduce((a,b) => a+b) / rateHistory.length // drops per second
  const rateMlPerMin = (avgRate * 60) / 20.0 // ml per minute
  
  let timeRemaining = 0
  if (rateMlPerMin > 0) {
      timeRemaining = remaining / rateMlPerMin
  }
  
  res.json({
   remaining: remaining,
   timeRemaining: timeRemaining,
   rateHistory: rateHistory,
   totalDrops: drops,
   totalVolume: totalVolume,
   anomaly: anomalyAlert
  })
 })
})

// Log data for self-learning (retraining)
app.post("/log-data", (req, res) => {
 const { rateHistory: history, totalDrops: drops, remaining } = req.body
 
 if(!Array.isArray(history) || history.length !== MAX_HISTORY) {
  return res.status(400).json({error: "Invalid rate history"})
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
 
 res.json({status: "logged"})
})

app.listen(5000,()=>{
 console.log("Server running on port 5000")
 console.log("🤖 ML features enabled")
 console.log("📝 Data logging for self-learning active")
})