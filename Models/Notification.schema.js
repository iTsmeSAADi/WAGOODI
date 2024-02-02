const mongoose = require("mongoose")

const NotificationSchema = new mongoose.Schema({
    createdAt: {type: Number, default: Math.floor(Date.now() / 1000)},
    orderId: {type: mongoose.Types.ObjectId, ref: "order"},
    description: {type: String, required: true},
    type: {type: Number, enum: [0, 1, 2], required: true, default: 1}, // 0 : admin, 1: Order, 2: Driver.
    companyId: {type: mongoose.Types.ObjectId, ref: 'company'},
    stationId: {type: mongoose.Types.ObjectId, ref: 'station'},
    accountId: {type: mongoose.Types.ObjectId, ref: "account"}, //driver id
    viewBy: [{type: mongoose.Types.ObjectId, ref: "account"}], // accountId
    subscriptionId: {type: mongoose.Types.ObjectId, ref: "subscription"}
})

const Notification = mongoose.model("notification", NotificationSchema);

module.exports = Notification;