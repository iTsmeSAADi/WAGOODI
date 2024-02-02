const mongoose = require("mongoose")

const DaySaleSchema = mongoose.Schema({
    stationId: {type: mongoose.Types.ObjectId, required: true, ref: "station"},
    amount: {type: Number, required: true},
    fuel_value: {type: Number}, 
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)},
}) 

const DaySale = mongoose.model("daysale", DaySaleSchema)

module.exports = DaySale