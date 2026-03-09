const express = require("express")
const cors = require("cors")

const { SerialPort } = require("serialport")
const { ReadlineParser } = require("@serialport/parser-readline")

const app = express()

app.use(cors())
app.use(express.json())

let flowStatus = "UNKNOWN"

// Arduino serial
const port = new SerialPort({
 path: "/dev/cu.usbserial-A5069RR4",
 baudRate: 9600
})

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }))

parser.on("data",(line)=>{

 console.log("Arduino:",line)

 if(line.includes("FLOW_STOPPED")){
  flowStatus = "STOPPED"
 }

 if(line.includes("FLOW_RUNNING")){
  flowStatus = "RUNNING"
 }

})

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

// get flow status
app.get("/status",(req,res)=>{

 res.json({
  flow:flowStatus
 })

})

app.listen(5000,()=>{

 console.log("Server running on port 5000")

})