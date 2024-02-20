const cron = require("node-cron");
const DayOrder = require("./Models/DayOrder.schema.js");
const Station = require("./Models/Station.schema.js");
const Sale = require("./Models/Sale.schema.js");
const DaySale = require("./Models/DaySale.schema.js");
const { io } = require("./index.js");
const Company = require("./Models/Company.schema.js")

async function stationsTotalOrderSale() {
  console.log("test 1")
};

async function stationRealTimeData() {
  console.log('test 2')
};


module.exports = {
  stationsTotalOrderSale,
  stationRealTimeData,
};