const mongoose = require("mongoose")

const CompanySchema  = new mongoose.Schema({
    stations: [{type: mongoose.Types.ObjectId, ref: 'station'}],
    vendors: [{type: mongoose.Types.ObjectId, ref: "vendor"}],
    name: {type: String, required: true, unique: true},
    phone: {type: String, required: true},
    email: {type: String, required: true},
    address: {type: String, required: true},
    crn_number: {type: String, required: true},
    tax_number: {type: String, required: true},
    isValid: {type:Boolean, default: true},
    imageUrl: {type: String, default: null},
    approved: {type:Boolean, default: false},
    paymentMethodToken: {type: String},
    subscriptionType: {type: Number, enum: [0, 1, 2]}, // 0: basic, 1: enterprise, 2: trial
    allowedStations: {type: Number},
    tier: {type: Number, enum: [0, 1, 2, 3]}, // 0: 1 month, 1: 3 month, 2: 6 month, 3: 12 month
    subscriptionId: {type: mongoose.Types.ObjectId, ref: "subscription"}
})

const Company = mongoose.model("company", CompanySchema)

module.exports = Company;