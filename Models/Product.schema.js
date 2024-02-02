const mongoose = require("mongoose")

const ProductSchema = new mongoose.Schema({
    type: {type: Number, enum: [0, 1], required: true}, // 0: basic, 1: enterprise
    sub_type: {type: Number, enum: [0, 1, 2]}, // 0 : silver, 1 : gold, 2 : diamond 
    description: {type: String, default: "One time payment"},
    station_quantity_charge: {type: Number, required: true},
    frequency_interval: {type: Number, enum: [1, 3, 6, 12], required: true},
    amount: {type: Number, required: true},
    currency: {type: String, length: 3, default: "USD"},
    billingPlanId: {type: String}
})

const Product = mongoose.model("product", ProductSchema)

module.exports = Product;