const mongoose = require("mongoose")

const StationSchema = new mongoose.Schema({
    companyId: {type: mongoose.Types.ObjectId, required: true},
    active: {type: Boolean, default: false},
    managerId: {type: mongoose.Types.ObjectId},
    fuels: [{type: mongoose.Types.ObjectId, required: true, ref: "fuel"}],
    name: {type: String, required: true},
    address: {type: String, required: true},
    phone: {type: String},
    latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    favorite: {type: Boolean, default: false},
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)}
})

const Station = mongoose.model("station", StationSchema)

module.exports = Station;