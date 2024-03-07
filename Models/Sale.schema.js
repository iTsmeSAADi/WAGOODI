const mongoose = require("mongoose")

const SaleSchema = new mongoose.Schema({
    stationId: {type: mongoose.Types.ObjectId, required: true, ref: "station"},
    amount: {type: Number, required: true},
    fuel_value: {type: Number}, 
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)},
    active: {type: Boolean, default: true},
    fuel_type: {type: Number, enum: [0, 1, 2], required: true},
})

const Sale = mongoose.model("sale", SaleSchema);

module.exports = Sale;