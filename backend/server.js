const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")

const { SerialPort } = require("serialport")
const { ReadlineParser } = require("@serialport/parser-readline")

const Data = require("./models/data")

const app = express()

app.use(cors())
app.use(express.json())

mongoose.connect("mongodb://127.0.0.1:27017/iot")

// ---------- Arduino Serial ----------
const port = new SerialPort({
 path:"/dev/cu.usbmodem1101",
 baudRate:9600
})

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }))

// ---------- Read Arduino ----------
parser.on("data", async(line)=>{

 console.log("Arduino:",line)

 if(line.startsWith("TEMP:")){

   const temp = parseFloat(line.split(":")[1])

   await Data.create({
     temperature:temp,
     time:new Date()
   })
 }

})

// ---------- API get data ----------
app.get("/data", async(req,res)=>{

 const data = await Data.find().sort({time:-1}).limit(10)

 res.json(data)
})

// ---------- Send Heart Rate ----------
app.post("/heart",(req,res)=>{

 const {hr} = req.body

 port.write(`HR${hr}\n`)

 res.json({status:"sent"})
})

// ---------- Send SPO2 ----------
app.post("/spo2",(req,res)=>{

 const {sp} = req.body

 port.write(`SP${sp}\n`)

 res.json({status:"sent"})
})

app.listen(5000,()=>{

 console.log("Server running on port 5000")

})