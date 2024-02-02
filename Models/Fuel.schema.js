const mongoose = require("mongoose")

const FuelTypeSchema = mongoose.Schema({
    type: {type: Number, enum: [0,1,2], required: true},
    price_litre: {type: Number, required: true},
    value: {type: Number, min: 0},
    max_value: {type: Number}
})

const Fuel = mongoose.model("fuel", FuelTypeSchema)

module.exports = Fuel;