const mongoose = require("mongoose")

const SubscriptionSchema = new mongoose.Schema({
    active: {type: Boolean, default: null},
    start_date: {type: String},
    subscriptionType: {type: Number, enum: [0, 1]}, // 0: basic, 1: Enterprise,
    sub_type: {type: Number, enum: [0, 1, 2]}, // 0: silver, 1 : gold, 2 : diamond
    billingAgreementId: {type: String}, // aggrementPlanId for paypal plan agreement
    billingPlanId: {type: String}, // billingPlanId for paypal plan Id
    productId: {type: mongoose.Types.ObjectId, required: true, ref: "product"},
    companyId: {type: mongoose.Types.ObjectId, ref: "company", required: true},
    accountId: {type: mongoose.Types.ObjectId, ref: "account", required: true},
    token: {type: String},
    // tier: {type: Number, enum: [0, 1, 2, 3]},  // 0: one-month, 1: three-month, 2: six-month, 3: twelve-month 
    valid_until: {type:  Number },
})

const Subscription = mongoose.model("subscription", SubscriptionSchema)

module.exports = Subscription;