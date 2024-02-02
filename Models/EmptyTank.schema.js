const mongoose = require("mongoose")

const EmptyTankSchema = new mongoose.Schema({
    stationId: {type: mongoose.Types.ObjectId, ref: "stations", required: [true, "staionId is required!"]},
    duration: {type: Number},
    fuelId: {type: mongoose.Types.ObjectId, ref:"fuels", required: true},
    companyId: {type: mongoose.Types.ObjectId, ref: "company", required: [true, "companyId is required!"]},
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)}
})

const EmptyTankModel = mongoose.model("emptyTank", EmptyTankSchema)

module.exports = EmptyTankModel;