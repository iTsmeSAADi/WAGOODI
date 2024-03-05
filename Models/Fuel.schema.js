const mongoose = require("mongoose")

const FuelTypeSchema = mongoose.Schema({
    type: {type: Number, required: true},
    type_name: {type: String, required: true},
    price_litre: {type: Number, required: true},
    value: {type: Number, min: 0},
    max_value: {type: Number}
})

const Fuel = mongoose.model("fuel", FuelTypeSchema)

module.exports = Fuel;