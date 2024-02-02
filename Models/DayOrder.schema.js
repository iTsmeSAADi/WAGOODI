const mongoose = require("mongoose")

const DayOrderSchema = new mongoose.Schema({
    companyId: {type: mongoose.Types.ObjectId, required: true},
    stationId: {type: mongoose.Types.ObjectId, required: true},
    recieved_value: {type: Number, required: true},
    amount: {type: Number, required: true},
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)},
    driverId: {type: mongoose.Types.ObjectId, ref: "account"},
})

const DayOrder = mongoose.model("dayorder", DayOrderSchema)

module.exports = DayOrder;