const mongoose = require("mongoose")

const VendorSchema = new mongoose.Schema({
    companyId: {type: mongoose.Types.ObjectId, required: true},
    name: {type: String, required: true},
    address: {type: String, required: true},
    fuels: [{type: mongoose.Types.ObjectId, required: true, ref: "fuel"}],
    
})

const Vendor = mongoose.model("vendor", VendorSchema)

module.exports = Vendor;