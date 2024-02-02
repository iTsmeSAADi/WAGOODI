const mongoose = require("mongoose")

const TruckSchema = new mongoose.Schema({
    driverId: {type: String, required: true, ref: "account"},
    plate_number: {type: String, required: true},
    capacity: {type: Number, required: true}
})

const TruckModel = mongoose.model("truck", TruckSchema)

module.exports = TruckModel;