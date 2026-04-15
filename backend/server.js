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
let rateHistory = [] // recent rate history for ML
let totalDrops = 0
let anomalyAlert = null
const MAX_HISTORY = 5

// Arduino serial
const port = new SerialPort({
 path: "/dev/cu.usbserial-A5069RR4",
 baudRate: 9600
})

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }))

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

 // look for drop notification with rate (e.g., "Drop detected: 2.1 drops/sec")
 if(line.toLowerCase().includes("drop")){
  dropMessage = line.trim()
  
  // Extract rate if available
  const rateMatch = line.match(/(\d+\.?\d*)\s*(?:drops?\/sec|drop)/)
  if(rateMatch) {
   const rate = parseFloat(rateMatch[1])
   updateRateHistory(rate)
   totalDrops++
   checkAnomalies()
  }
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
 port.write(`HR${hr}\n`)
 res.json({status:"sent"})
})

// send SPO2
app.post("/spo2",(req,res)=>{
 const {sp} = req.body
 port.write(`SP${sp}\n`)
 res.json({status:"sent"})
})

// get flow status and any drop message
app.get("/status",(req,res)=>{
 res.json({
  flow: flowStatus,
  drop: dropMessage,
  rateHistory: rateHistory,
  totalDrops: totalDrops,
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
 
 exec(`python3 backend/ml/predict.py ${inputs}`, (error, stdout, stderr) => {
  if(error) {
   console.error("ML error:", stderr)
   return res.status(500).json({error: "Prediction failed"})
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