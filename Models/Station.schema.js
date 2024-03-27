const mongoose = require("mongoose")

const StationSchema = new mongoose.Schema({
    companyId: {type: mongoose.Types.ObjectId, required: true},
    active: {type: Boolean, default: false},
    managerId: {type: mongoose.Types.ObjectId},
    fuels: [{type: mongoose.Types.ObjectId, required: true, ref: "fuel"}],
    name: {type: String, required: true},
    address: {type: String, required: true},
    stationNumber: { type: Number, unique: true },
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

StationSchema.pre("save", async function(next) {
  // Generate unique order number
  if (!this.stationNumber) {
    let found;
    do {
      this.stationNumber = Math.floor(Math.random() * 90000) + 1000;
      found = await this.constructor.findOne({ stationNumber: this.stationNumber });
    } while (found);
  }
  next();
});


const Station = mongoose.model("station", StationSchema)

module.exports = Station;