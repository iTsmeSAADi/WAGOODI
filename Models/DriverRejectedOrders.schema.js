const mongoose = require("mongoose")

const DriverRejectedOrdersSchema = new mongoose.Schema({
    driverId: {type: mongoose.Types.ObjectId, ref: "drivers", required: true},
    order: {type: mongoose.Types.ObjectId, ref:"orders", required: true},
    companyId: {type: mongoose.Types.ObjectId, ref:"companies", required: true},
    description: {type: String, required: false},
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)}
})

const DriverRejectedModel = mongoose.model("driverRejectedOrders", DriverRejectedOrdersSchema)

module.exports = DriverRejectedModel;