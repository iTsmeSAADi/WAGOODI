const express = require("express");
const cors = require("cors");
const multer = require("multer");
// const {ConnectionOptions} = require("mongoose");
// const moment = require('moment')
const upload = multer({ dest: "dataFiles/" });
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const DayOrder = require("./Models/DayOrder.schema.js");
const Station = require("./Models/Station.schema.js");
const Sale = require("./Models/Sale.schema.js");
const DriverRejectedModel = require('./Models/DriverRejectedOrders.schema')
const DaySale = require("./Models/DaySale.schema.js");
const { Server } = require("socket.io");
const http = require("http");
const paypal = require('paypal-rest-sdk');


const authRoutes = require("./Routes/auth.route.js");
const stationRoutes = require("./Routes/station.route.js");
const statisticRoutes = require("./Routes/statistics.route.js");
const truckRoutes = require("./Routes/truck.route.js");
const companyRoutes = require("./Routes/company.route.js");
const orderRoutes = require("./Routes/order.route.js");
const notificationRoutes = require("./Routes/notification.route.js")
const subscriptionRoutes = require("./Routes/subscription.route.js")
const productRoutes = require("./Routes/product.route.js")
const vendorRoutes = require("./Routes/vendor.route.js");
const Subscription = require("./Models/Subscriptions.schema.js");
const Product = require("./Models/Product.schema.js");
const { createError } = require("./Utils/responseMessage.js");
const { successSubscription } = require("./Controllers/subscription.controllers.js");
const Order = require("./Models/Order.schema.js");
const Tracking = require("./Models/Tracking.schema.js");
require("./db.connect.js")()
const PAYPAL_TOKEN = process.env.PAYPAL_TOKEN;
const PORT = process.env.PORT;
const EMAIL_PASSWORD = process.env.email_pass;
const SOCKET_SECRET_KEY = process.env.SOCKET_SECRET_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET_KEY;
const APP_ID = process.env.APP_ID;
const ExactHostname = 
"http://127.0.0.1:5173"
// "http://localhost:5173";
// "https://65842b8f7e948fe879d031cd--golden-pony-e53c7a.netlify.app";

const app = express();
const server = http.createServer(app);

global.upload = upload

paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': PAYPAL_CLIENT,
  'client_secret': PAYPAL_SECRET
});
app.use(cookieParser());
app.use(express.json());

app.use(cors(
  { 
    origin: true,
    credentials: true
}
));

// cron job schedule

const Company = require("./Models/Company.schema.js")

async function stationsTotalOrderSale() {
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
          await Promise.all(
            todayOrders.map(async (order) => {
              let stationFuelsRecievedOrders = [];
              let stationFuelsPriceOrders = [];

              await Promise.all(
                order.stations.map(({ id, fuel_value, fuel_recieved }) => {
                  if (id == station._id) {
                    stationFuelsRecievedOrders.push(fuel_recieved);
                    stationFuelsPriceOrders.push(fuel_value);
                  }
                  return;
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
                todaySales?.map(({ fuel_value }) => (saleTotalFuel += fuel_value))
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
        })
      );
      console.log("Successfully completed calculation of DayOrder and DaySale for all stations!");
    } catch (error) {
      console.log("Error running cron job for DayOrder And DaySale : ", error);
    }
  });
};


async function stationRealTimeData() {
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
      console.log("ERROR IN CRON_JOB : ", error);
    }
  });
};


// module.exports = {
//   stationsTotalOrderSale,
//   stationRealTimeData,
// };

app.post("/webhook/paypal", async (req, res) => {
  const webhook_body = req.body
  console.log("==================> WEBHOOK CALLED <======================")
  console.log("WEBHOOK BODY :", webhook_body)
  const {event_type, resource: {id: billingAgreementId}} = webhook_body;
  console.log("webhook event : ", event_type)
  try {
    let subscription;
    switch (event_type) {
      case "BILLING.SUBSCRIPTION.CREATED", "BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.RE-ACTIVATED":
        subscription = await Subscription.findOne({billingAgreementId})
        subscription.active = true;
        const product = await Product.findById(subscription.productId)
        const startDate = new Date()
        let end_date = new Date(startDate)
        end_date.setMonth( startDate.getMonth() + product.frequency_interval)
        subscription.valid_until = end_date;
        await subscription.save();
        break;
        case "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        subscription = await Subscription.findOneAndUpdate({billingAgreementId}, {active: false}, {new: true})
        break;
      default:
        return
    }
    console.log("Subscription : ", subscription)
    res.send("Succesfully updated!")
    return;
  } catch (error) {
    console.log(error)
    return;
  }
})

app.use((req, res, next) => {
  // res.header('Access-Control-Allow-Origin', "*");
  // res.header('Access-Control-Allow-Credentials', true);
  // res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  const app_secret = req?.headers["app_secret"];
  const token = req.query?.token;
  console.log("app_secret : ", app_secret)
  if(token != PAYPAL_TOKEN && app_secret != APP_ID) return createError(res, 401, "App is Unauthorized!")
    // const app_id = jwt.verify(app_secret, PRIVATE_KEY) 
  // CODE SHOULD BE CONTINUED : ONLY APP_ID IS LEFT AND THEN JWT TOKEN CREATION IS TO BE DONE
  next();
});
// we should have cors object specified here,

app.use(function (req, res, next) {
  console.log("req.originalUrl", req.originalUrl)
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// socket io functionalities;

const io = new Server(server, {cors: {origin: true}}); // socket io server!
// const io = require("socket.io").
app.io = io;
app.set("io", io)
global.io = io;

function socketEmit(socket, event, data) {
  socket.emit(event, data)
}

io.on("connection", async (socket) => {
  console.log("connection established!");
  try {
    const { secretkey, token } = socket.handshake.headers;
    const { _doc: user } = jwt.verify(token, PRIVATE_KEY);
    console.log("USER : ", user);
    if (secretkey !== SOCKET_SECRET_KEY || !token || !user) {
      return socket.disconnect();
    }

    switch (user.role) {
      case 0:
        console.log("===============admin SOCKET JOINED==============");
        socket.join("/admin");
        break;
      case 1:
        console.log("===============company SOCKET JOINED==============");
        socket.join([
          "/companyAdmin-" + user.companyId._id,
          "/order-" + user.companyId._id,
        ]);
        break;
      case 2:
        console.log("===============ordermanager SOCKET JOINED==============");
        socket.join([
          "/orderManager-" + user.companyId._id,
          "/order-" + user.companyId._id,
        ]);
        break;
      case 3:
        console.log("===============stationmanager SOCKET JOINED==============");
        socket.join("/stationManager-" + user.stationId);
        break;
      case 4:
        console.log("===============DRIVER SOCKET JOINED==============");
        socket.join([
          "/companyDriver-" + user.companyId._id,
          "/driver-" + user._id,
          `/company/drivers-${user.companyId._id}`,
        ]);
        // Your socket logic
        socket.join([
          "/companyDriver-" + user.companyId._id,
          "/driver-" + user._id,
          `/company/drivers-${user.companyId._id}`,
        ]);
        
        const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
        

        try {
          // Get the rejected orders by the driver within the last 24 hours
          const rejectedOrders = await driverRejectedModel.find({
            driverId: user._id,
            createdAt: { $gte: twentyFourHoursAgo },
          });
      
          // Extract the orderIds from the rejected orders
          const rejectedOrderIds = rejectedOrders.map((rejectedOrder) => rejectedOrder.orderId);
      
          // Fetch orders that are not in the rejectedOrderIds list
          const orders = await Order.find({
            $and: [
              {
                $or: [
                  { driverId: user._id, status: 1, createdAt: { $gte: twentyFourHoursAgo } },
                  { status: 0, createdAt: { $gte: twentyFourHoursAgo } },
                ],
              },
              { _id: { $nin: rejectedOrderIds } },
            ],
          });
      
          console.log("Driver Orders with status 1 created within the last 24 hours and unassigned to any driver:", orders);
      
          socket.emit('notification-message', orders);
        } catch (error) {
          console.error("Error fetching driver orders:", error);
        }
        
          // // Inside an asynchronous function
          // const twentyFourHoursAgo = moment().subtract(24, 'hours').unix();

          // try {
          //   const tracking = await Tracking.find({
          //     driverId: user._id,
          //     createdAt: { $gte: twentyFourHoursAgo }
          //   });

          //   console.log('Tracking data in the last 24 hours:', tracking);
          //   socket.emit("tracking", tracking)
          // } catch (error) {
          //   console.error('Error fetching tracking data:', error);
          //   // Handle the error accordingly
          // }

        socket.on("/tracking/update", async (data) => {
          const { trackingId, orderId, location, role, accountId, companyId } = data;
          if (!trackingId || !orderId || !location || !role || !accountId || !companyId) {
            socketEmit(socket, "error", { error: "Incomplete data provided!" });
            return;
          }

          try {
            const order = await Order.findOne({ _id: orderId, companyId });
            if (!order) {
              socketEmit(socket, "error", { error: "Order with such orderId and companyId not found!" });
              return;
            }

            if (order.driverId !== accountId) {
              socketEmit(socket, "error", { error: "accountId does not match driverId of an Order!" });
              return;
            }

            const tracking = await Tracking.findOneAndUpdate(
              { _id: trackingId, orderId, driverId: accountId },
              { location },
              { new: true }
            );

            if (!tracking) {
              socketEmit(socket, "error", { error: "Tracking not found with the specified conditions!" });
              return;
            }

            // Emit the tracking data to the driver socket
            io.to(`/driver-${user._id}`).emit("tracking-update", { order, tracking });
          } catch (error) {
            console.log("SOCKET ERROR");
            console.log(error);
            socketEmit(socket, "error", { error: "Error processing tracking update!" });
          }
        });

        break;
      default:
        console.log("No other than company room joined!");
        socket.join(`/company-${user.companyId._id}`);
        break;
    }
  } catch (error) {
    console.log("SOCKET ERROR");
    console.log(error);
  }
});




app.use("/auth", authRoutes);
app.use("/station", stationRoutes);
app.use("/order", orderRoutes);
app.use("/notification", notificationRoutes)
app.use("/vendor", vendorRoutes)
app.use("/company", companyRoutes)
app.use("/truck", truckRoutes)
app.use("/statistics", statisticRoutes)
app.use("/subscription", subscriptionRoutes)
app.use("/product", productRoutes)
// app.use("/fuel")
// app.use("/attachment")
// app.use("/tracking")

// // ...

// const cron_job = require("./cron_job.js");

// DayOrder and DaySale is totalled and saved every midnight.
// 0 0 0 * * *
stationsTotalOrderSale();
stationRealTimeData();


app.use("*", (req, res) => res.status(404).send("Not Found!"));
app.use((req, res, error) => {
  console.log(error);
  res.status(400).json({ success: false, error });
});

server.listen(PORT, async (error) => {
  if (error) return console.log("SERVER_CONNECTION ERROR", error);
  console.log("Server connected on ", PORT);
});


module.exports = {
  upload: upload,
  io: io,
  paypal
};
