const express = require("express");
const cors = require("cors");
const multer = require("multer");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const cron = require("node-cron");
const { Server } = require("socket.io");
const http = require("http");
const paypal = require('paypal-rest-sdk');

const cron_job = require("./cron_job.js");
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

const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET_KEY;
const PORT = process.env.PORT;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

app.io = io;
app.set("io", io)
global.io = io;

paypal.configure({
  'mode': 'sandbox',
  'client_id': PAYPAL_CLIENT,
  'client_secret': PAYPAL_SECRET
});

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.post("/webhook/paypal", async (req, res) => {
  const webhook_body = req.body;
  console.log("==================> WEBHOOK CALLED <======================");
  console.log("WEBHOOK BODY :", webhook_body);
  const {event_type, resource: {id: billingAgreementId}} = webhook_body;
  console.log("webhook event : ", event_type);

  try {
    let subscription;

    switch (event_type) {
      case "BILLING.SUBSCRIPTION.CREATED":
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
        subscription = await Subscription.findOne({billingAgreementId})
        subscription.active = true;
        const product = await Product.findById(subscription.productId)
        const startDate = new Date()
        let end_date = new Date(startDate)
        end_date.setMonth( startDate.getMonth() + product.frequency_interval)
        subscription.valid_until = end_date;
        await subscription.save();
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        subscription = await Subscription.findOneAndUpdate({billingAgreementId}, {active: false}, {new: true})
        break;

      default:
        return;
    }

    console.log("Subscription : ", subscription);
    res.send("Succesfully updated!");
    return;
  } catch (error) {
    console.log(error);
    return;
  }
});

app.use((req, res, next) => {
  const app_secret = req?.headers["app_secret"];
  const token = req.query?.token;
  console.log("app_secret : ", app_secret);

  if(token != PAYPAL_TOKEN && app_secret != APP_ID) {
    return createError(res, 401, "App is Unauthorized!");
  }

  next();
});

app.use(function (req, res, next) {
  console.log("req.originalUrl", req.originalUrl)
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const io = new Server(server, {cors: {origin: true}});
app.io = io;
app.set("io", io)
global.io = io;

function socketEmit(socket, event, data) {
  socket.emit(event, data)
}

io.on("connection", (socket) => {
  console.log("connection established!");

  try {
    const { secretkey, token } = socket.handshake.headers;
    const {_doc: user} = jwt.verify(token, PRIVATE_KEY);
    console.log("USER : ", user)

    if (secretkey != SOCKET_SECRET_KEY || !token || !user) {
      return socket.disconnect();
    }

    switch (user.role) {
      case 0:
        console.log("===============admin SOCKET JOINED==============")
        socket.join("/admin");
        break;

      case 1:
        console.log("===============company SOCKET JOINED==============")
        socket.join([
          "/companyAdmin-" + user.companyId._id,
          "/order-" + user.companyId._id,
        ]);
        break;

      case 2:
        console.log("===============ordermanager SOCKET JOINED==============")
        socket.join([
          "/orderManager-" + user.companyId._id,
          "/order-" + user.companyId._id,
        ]);
        break;

      case 3:
        console.log("===============stationmanager SOCKET JOINED==============")
        socket.join("/stationManager-" + user.stationId);
        break;

      case 4:
        console.log("===============DRIVER SOCKET JOINED==============")
        socket.join(["/companyDriver-" + user.companyId._id, "/driver-" + user._id, `/company/drivers-${user.companyId._id}`] )
        break;

      default:
        console.log("no other than company room joined!")
        socket.join(`/company-${user.companyId._id}`)
        break;
    }
  
    socket.on("/tracking/update", async (data) => {
      const {trackingId, orderId, location, role, accountId, companyId} = data;
      
      if(!trackingId) {
        socketEmit(socket, "error", {error: "trackingId is undefined!"})
        return;
      } 
      
      if(!orderId) {
        socketEmit(socket, "error", {error: "orderId is undefined!"})
        return;
      } 
      
      if(!location) {
        socketEmit(socket, "error", {error: "location is undefined!"})
        return;
      } 
      
      if(!role) {
        socketEmit(socket, "error", {error: "role is undefined!"})
        return;
      } 
      
      if(!accountId) {
        socketEmit(socket, "error", {error: "accountId is undefined!"})
        return;
      } 
      
      if(!companyId) {
        socketEmit(socket, "error", {error: "companyId is undefined!"})
        return;
      } 

      const order = await Order.findOne({_id: orderId, companyId})
      if(!order) {
        socketEmit(socket, "error", {error: "Order with such orderId and companyId not found!"})
        return;
      }

      if(orderId.driverId != accountId){
        socketEmit(socket, "error", {error: "accountId does not match driverId of an Order!"})
        return;
      }

      const tracking = await Tracking.findOneAndUpdate({_id: trackingId, orderId, driverId: accountId}, {new: true})
      io.to(`/company-${companyId}`).emit("order-location", {order, tracking})
    });
  } catch (error) {
      console.log("SOCKET ERROR")
      console.log(error)
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

// DayOrder and DaySale is totalled and saved every midnight.
// 0 0 0 * * *
cron_job.stationsTotalOrderSale();
cron_job.stationRealTimeData();

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
  paypal: paypal
};
