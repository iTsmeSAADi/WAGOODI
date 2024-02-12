const mongoose = require("mongoose")

const OTPSchema = new mongoose.Schema({
    accountId: {type: mongoose.Types.ObjectId, ref:"acoount", required: true},
    otp: {type: "String", required: true},
    expiresAt: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000) + 30,  // 30 seconds from the current time
      },      
}, {versionKey: false})

const OTP = mongoose.model('otp', OTPSchema);

module.exports = OTP;