const mongoose = require("mongoose")

const DataSchema = new mongoose.Schema({
 temperature:Number,
 time:Date
})

module.exports = mongoose.model("Data",DataSchema)