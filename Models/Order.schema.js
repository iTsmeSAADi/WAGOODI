const mongoose = require("mongoose");
const moment = require("moment-timezone");

const OrderSchema = new mongoose.Schema({
  orderManagerId: { type: mongoose.Types.ObjectId, required: true },
  fuel_quantity: {type: Number, required: true},
  stations: [
    {
      id: { type: mongoose.Types.ObjectId, required: true, ref: "station" },
      address: String,
      status: {
        type: Number,
        enum: [0, 1, 2, 3, 4, 5], // 0 : on-going, 1 : assigned, 2: received, 3: delivered, 4 : complete
        default: 0,
      },
      name: String,
      pickedAt: { type: Number },
      deliveryTime: { type: Number, default: null }, // Set deliveryTime default to null
      // Add latitude and longitude properties
      latitude: { type: Number },
      longitude: { type: Number },
      required_volume: { type: Number, required: true },
      paid_amount: {type: Number, required: true},     
      fuelId: { type: mongoose.Types.ObjectId, required: true, ref: "fuel" },
      value: {type: Number, ref: "fuel"}
    },
  ],
  orderNumber: { type: Number, unique: true },
  driverId: { type: mongoose.Types.ObjectId, ref: "account" },
  attachments: [
    {
      name: { type: String, required: true },
      url: { type: String, required: true },
      stationId: { type: mongoose.Types.ObjectId, ref: "stations" },
    },
  ],
  companyId: { type: mongoose.Types.ObjectId, required: true, ref:"company" },
  trackingId: { type: mongoose.Types.ObjectId },
  status: {
    type: Number,
    enum: [0, 1, 2, 3, 4, 5], // 0 : ordered, 1 : assigned, 2: picked-up, 3: delivered, 4 : approved, 5: canceled
    default: 0,
  },
  canceled: {
    reason: { type: String },
    role: {
      type: Number,
      enum: [2, 4], // 2: orderManager, 4: driver
    },
    userId: { type: mongoose.Types.ObjectId, ref: "account" },
  },
  fuel_type: { type: Number, enum: [0, 1, 2], required: true }, // 0: 95, 1: 91, 2: D
  // fuel_value: { type: Number, required: true },
  // fuel_recieved: { type: Number},
  // fuel_price: { type: Number, required: true },
  to: { type: [String], required: false },
  from: {
    option: {
      type: Number,
      enum: [0, 1], // 0 : vendor, 1 : station
      required: true,
    },
    fuelId: { type: mongoose.Types.ObjectId},
    stationId: { type: mongoose.Types.ObjectId, ref: "stations" },
    vendorId: { type: mongoose.Types.ObjectId, ref: "vendors" },
    address: {type: String, required: true},
    // Add latitude and longitude properties
    latitude: { type: Number },
    longitude: { type: Number },
  },
  createdAt: { type: Number, default: () => moment().tz("Asia/Karachi").unix() },
  arrival_date: { type: Number },
  expected_arrival: {type: Number},
  reciept_number: {type: String, required: true},
  startedAt: {type: Number},
  driverTip: {type: Number},
  issued_volume: { type: Number, required: function() { return this.status === 4; } },
  received_volume: { type: Number, required: function() { return this.status === 4; } },
});

OrderSchema.pre("save", async function(next) {
  // Generate unique order number
  if (!this.orderNumber) {
    let found;
    do {
      this.orderNumber = Math.floor(Math.random() * 90000) + 1000;
      found = await this.constructor.findOne({ orderNumber: this.orderNumber });
    } while (found);
  }
  next();
});

const Order = mongoose.model("order", OrderSchema);

module.exports = Order;
