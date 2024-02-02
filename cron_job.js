const cron = require("node-cron");
const DayOrder = require("./Models/DayOrder.schema.js");
const Station = require("./Models/Station.schema.js");
const Sale = require("./Models/Sale.schema.js");
const DaySale = require("./Models/DaySale.schema.js");
const { io } = require("./index.js");
const Company = require("./Models/Company.schema.js")

const stationsTotalOrderSale = async () => {
  cron.schedule("0 0 0 * * *", async function () {
    console.log("Midnight schedule for DayOrder and DaySale!");
    try {
      const allStations = await Station.find({});
      await Promise.all(
        allStations.map(async (station) => {
          const startOfDay = Math.floor(Date.now() / 1000 - 24 * 60 * 60);
          const endOfDay = Math.floor(Date.now() / 1000);
          const query = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
          const todayOrders = await Order.find({
            ...query,
            stations: { $elemMatch: { id: station._id } },
          });
          let stationFuelsRecievedOrders = [];
          let stationFuelsPriceOrders = [];
          await Promise.all(
            todayOrders.map(async (order) => {
              await Promise.all(
                order.stations.map(
                  ({ id, fuel_value, fuel_recieved }) => {
                    if (id == station._id) {
                      stationFuelsRecievedOrders.push(fuel_recieved);
                      stationFuelsPriceOrders.push(fuel_value);
                    }
                    return;
                  }
                )
              );
            })
          );
          let orderTotalPrice = 0;
          await Promise.all(
            stationFuelsPriceOrders?.map((fuel_price) => {
              orderTotalPrice += fuel_price;
              return;
            })
          );
          let orderTotalFuel = 0;
          stationFuelsRecievedOrders?.map((fuel_recieved) => {
            orderTotalFuel += fuel_recieved;
          });
          const todaySales = await Sale.find({ ...query, stationId: station._id });
          let saleTotalPrice = 0;
          await Promise.all(
            todaySales?.map(({ amount }) => (saleTotalPrice += amount))
          );
          let saleTotalFuel = 0;
          await Promise.all(
            todaySales?.map(
              ({ fuel_value }) => (saleTotalFuel += fuel_value)
            )
          );
          const dayOrder = await new DayOrder({
            companyId: station.companyId,
            stationId: station._id,
            recieved_value: orderTotalFuel,
            amount: orderTotalPrice,
            driverId: order.driverId,
            createdAt: endOfDay,
          }).save();
          const daySale = await new DaySale({
            stationId: station._id,
            amount: saleTotalPrice,
            fuel_value: saleTotalFuel,
            createdAt: endOfDay,
          }).save();
        })
      );
      console.log(
        "Successfully completed calculation of DayOrder and DaySale for all stations!"
      );
    } catch (error) {
      console.log("Error running cron job for DayOrder And DaySale : ", error);
    }
  });
};

const stationRealTimeData = async () => {
  cron.schedule("1 * * * * *", async () => {
    try {
      const premiumCompanies = await Company.find({ subscription: 0 });
      await Promise.all(
        premiumCompanies.map(async (company) => {
          const stations = await Station.find({
            companyId: company._id,
          }).populate("fuels");
          io.to("companyAdmin-" + company._id).emit("stations-data", stations);
        })
      );
    } catch (error) {
      console.log("ERROR IN CRON_JON : ", error);
    }
  });
};


module.exports = {
  stationsTotalOrderSale,
  stationRealTimeData,
};
