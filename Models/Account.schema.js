const mongoose = require("mongoose")

const AccountSchema = new mongoose.Schema({
    companyId: {type: mongoose.Types.ObjectId, ref: 'company'},
    role: {type: Number, enum:[0, 1, 2, 3, 4], required: true}, // 0: SuperAdmin, 1: CompanyAdmin, 2: OrderManager, 3: StationManager, 4: Driver.
    stationId: {type: mongoose.Types.ObjectId, ref: 'station'},
    on_going: {type: Boolean, default: false},  // if driver then on_going is specified, meaning he is assigned order or not.
    email: {type: String, required: true},
    password: {type: String, required: true},
    privilage: {type: Number}, // 1: OrderManager, 0: SalesManager
    approved: {type: Boolean},
    name: {type: String, required: true},
    phone_number: {type: Number},
    address: {type: String},
})

const Account = mongoose.model("account", AccountSchema)

module.exports = Account;