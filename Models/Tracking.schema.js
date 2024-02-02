const mongoose = require("mongoose")

const TrackingSchema = new mongoose.Schema({
    orderId: {type: mongoose.Types.ObjectId, required: true, ref: 'order'},
    driverId: {type: mongoose.Types.ObjectId, ref: 'account'},
    location: {type: String, required: true}
})

const Tracking = mongoose.model('tracking', TrackingSchema)

module.exports = Tracking;