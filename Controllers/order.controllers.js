const Order = require("../Models/Order.schema");
const Account = require("../Models/Account.schema");
const Tracking = require("../Models/Tracking.schema");
const Vendor = require("../Models/Vendor.schema");
const Station = require("../Models/Station.schema");
const pdfReport = require("../Utils/pdf_report");
const firebase_methods = require("../Utils/firebase");
const fs = require("fs");
const { sendMail } = require("../Utils/mail");
const Notification = require("../Models/Notification.schema");
const { createError } = require("../Utils/responseMessage");
const EmptyTankModel = require("../Models/EmptyTank.schema");
const Fuel = require("../Models/Fuel.schema");
const TruckModel = require("../Models/Truck.schema");
const DriverRejectedModel = require('../Models/DriverRejectedOrders.schema')
const { log } = require("console");

const stationOrders = async (req, res) => {
  const { stationId, start_date = 0, end_date = Math.floor(Date.now() / 1000), query } = req.body;
  if (!stationId)
    return res
      .status(200)
      .json({ success: false, error: { message: "stationId not defined!" } });
  try {
    const orders = await Order.find({
      stations: { $elemMatch: { id: stationId } },
      createdAt: { $gte: start_date, $lte: end_date },
      ...query,
    });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const {
      stations,
      orderManagerId,
      companyId,
      fuel_type,
      fuel_value,
      fuel_price,
      fuel_id,
      driverId,
      from,
      reciept_number,
      expected_arrival,
      driverTip,
    } = req.body;

    console.log('req.body', req.body);
    console.log('req.file', req.file);
    console.log('req.headers', req.headers);

    const attachment = req?.file?.buffer;
    const mimetype = req?.file?.mimetype;

    if (
      !stations ||
      !orderManagerId ||
      !companyId ||
      fuel_type == undefined ||
      !fuel_value ||
      !fuel_price ||
      !from
    )
      return res.status(200).json({
        success: false,
        error: { message: "Required fields are missing!" },
      });

    if (!Array.isArray(stations))
      return res.status(200).json({
        success: false,
        error: { message: "Stations field should be an array of objects!" },
      });

    if (typeof from !== "object")
      return res.status(200).json({
        success: false,
        error: { message: "From field should be an object!" },
      });

    console.log("Debugging information:", from.option, from.vendorId);

    if (
      from.option == {} ||
      (from.option === 0 && !from.vendorId) ||
      (from.option === 1 && !from.stationId)
    ) {
      return res.status(400).json({
        success: false,
        error: { message: "From field is missing required fields!" },
      });
    }

    if (from.option === 0 && !attachment)
      return res.status(200).json({
        success: false,
        error: { message: "Attachment of order receipt file is undefined!" },
      });

    const io = req?.app?.io;

    let to = [];
    let stationNameOrderError = [];

    await Promise.all(
      stations.map(async (selectedStation, index) => {
        const station = await Station.findById(selectedStation.id).populate(
          "fuels"
        );

        if (!station)
          return res.status(200).json({
            success: false,
            error: { message: "No such station found!" },
          });

        if (!station.active)
          return createError(res, 400, `Station ${station.name} is inactive!`);

        stations[index].address = station.address;
        to.push(station.address);

        const prevOrder = await Order.findOne({
          stations: { $elemMatch: { id: station.id } },
          fuel_type,
        });

        const status =
          prevOrder?.stations.find(
            (station) => station.id === selectedStation.id
          )?.status;

        const fuel = station.fuels.find((fuel) => fuel.type === fuel_type);
        const prevOrderFlag =
          prevOrder?.createdAt <= 86400 && status === 4;

        if (prevOrderFlag) {
          stationNameOrderError.push(station.name);
        }

        if (!prevOrderFlag && fuel?.value === 0) {
          let emptyTankFuel = await EmptyTankModel.findOne(
            { stationId: selectedStation.id, duration: null },
            null,
            { sort: { createdAt: -1 } }
          );

          if (emptyTankFuel) {
            emptyTankFuel = {
              ...emptyTankFuel,
              duration:
                Math.floor(Date.now() / 1000) - emptyTankFuel.createdAt,
            };
            await emptyTankFuel.save();
          }
        }
      })
    );

    if (stationNameOrderError.length > 0)
      return res.status(400).json({
        success: false,
        error: {
          msg: `Order for fuel type already placed for stations: ${stationNameOrderError.join(
            ", "
          )}`,
        },
      });

    const orderManager = await Account.findById(orderManagerId);

    if (!orderManager)
      return res.status(200).json({
        success: false,
        error: { message: "No such orderManager found!" },
      });

    if (req?.user?.companyId._id != orderManager.companyId.toString())
      return res.status(200).json({
        success: false,
        error: { message: "OrderManager is not of the specified company!" },
      });

    let attachmentName;
    let attachmentUrl;

    if (from.option === 0) {
      const vendor = await Vendor.findById(from?.vendorId);

      if (!vendor)
        return res.status(200).json({
          success: false,
          error: { message: "No such vendor found!" },
        });

      from.address = vendor.address;
      attachmentName = "order-receipt";
      attachmentUrl = await firebase_methods.uploadOrderAttachment(
        companyId,
        attachmentName,
        attachment,
        mimetype
      );
    }

    if (from.option === 1) {
      const station = await Station.findById(from.stationId);

      if (!station)
        return res.status(400).json({
          success: false,
          error: { message: "No such station found!" },
        });

      if (!fuel_id)
        return res.status(400).json({
          success: false,
          error: { message: "fuel_id is required for a station!" },
        });

      const fuelIdMatch = station.fuels.includes(fuel_id);

      if (!fuelIdMatch)
        return res.status(400).json({
          success: false,
          error: { message: "Station does not contain such id for a fuel!" },
        });

      from.address = station.address;

      if (driverId) {
        const driverTruck = await TruckModel.findOne({ driverId });

        if (fuel_value > driverTruck.capacity)
          return createError(
            res,
            400,
            "Driver truck capacity is lower than the fuel value!"
          );
      }

      await Fuel.findOneAndUpdate(
        { _id: fuel_id },
        { $inc: { value: fuel_value * -1 } }
      );
    }

    const attachmentObj =
      from.option === 0 ? [{ name: attachmentName, url: attachmentUrl }] : [];

    stations[0].status = 1;

    const order = await new Order({
      stations,
      orderManagerId,
      attachments: attachmentObj,
      companyId,
      fuel_type: parseInt(fuel_type),
      fuel_value,
      fuel_price,
      to,
      from,
      reciept_number,
      expected_arrival,
      startedAt: driverId ? Math.floor(Date.now() / 1000) : null,
      driverTip,
    }).save();

    // Emit notifications using Socket.IO before sending the response
    if (!driverId) {
      const notificationDesc = `Accept Or Reject Order ${order._id}`;
      const notifiactionOrder = await Order.findById(order._id);
      const specificStation = await Station.findById(stations[0].id);
      const companyDriversNotification = await new Notification({
        orderId: order._id,
        type: 2,
        orderData: notifiactionOrder,
        description: notificationDesc,
        stationId: specificStation,
      }).save();

      console.log("IO ", io);
      console.log('order company id', companyId)

      io.to(`/company/drivers-${companyId}`).emit("notification-message", {
        notification: companyDriversNotification,
        order: order,
      });
    }

    const notificationsCreation = await Promise.all(
      stations.map(async ({ id: stationId, name: stationName }) => {

        const notificationDesc = `${order._id} has been generated for ${stationName} Station!`;
        const notification = await new Notification({
          orderId: order._id,
          companyId,
          type: 1,
          description: notificationDesc,
          stationId,
          driverId,
        }).save();

        io.to("/admin")
          .to(`/companyAdmin-${companyId}`)
          .to(`/orderManager-${companyId}`)
          .to(`/stationManager-${stationId}`)
          .emit("notification-message", notification);

        if (!driverId) return;

        io.to(`/companyDriver-${driverId}`).emit(
          "notification-message",
          notification
        );
      })
    );

    if (!driverId) return;

    let driverNotificationDesc = `${order._id} has been assigned for ${stations[0].id} Station! Order destination is ${stations[0].address} `;
    const driverNotification = await new Notification({
      orderId: order._id,
      type: 2,
      description: driverNotificationDesc,
      stationId: stations[0].id,
      accountId: driverId,
    }).save();

    io.to(`/companyDriver-${driverId}`).emit("notification-message", driverNotification);

    // Send the response to the client after emitting notifications
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};


const driverGetOrders = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Check if driverId is provided
    if (!driverId) {
      return res.status(400).json({ message: 'Driver ID is required' });
    }

    console.log('driverId', driverId);

    // Assuming you have a model named "Order" for orders
    const assignedOrders = await Order.find({ driverId: driverId });

    if (!assignedOrders || assignedOrders.length === 0) {
      // Respond with an appropriate message if no orders are found
      return res.status(404).json({ message: 'No orders found for the given driverId' });
    }

    console.log('assignedOrders', assignedOrders);
    // Respond with the orders found for the given driverId
    res.status(200).json(assignedOrders);
  } catch (error) {
    console.error('Error in driverGetOrders:', error);
    // Handle the error and respond with an appropriate message
    res.status(500).json({ message: 'Internal Server Error' });
  }
};




const queryOrder = async (req, res) => {
  const {
    stationId,
    query = {},
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!stationId)
    return res
      .status(200)
      .json({ success: false, error: { message: "stationId is undefined!" } });
  try {
    const order = await Order.find({
      stations: { $elemMatch: { id: stationId } },
      ...query,
      createdAt: { $gte: start_date, $lte: end_date },
    });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const getOrder = async (req, res) => {
  const { id } = req.params;
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { message: "id undefined!" } });
  try {
    const order = await Order.findById(id);
    if (!order)
      return res
        .status(200)
        .json({ success: false, error: { message: "Not such order found!" } });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const allCompanyQueryOrders = async (req, res) => {
  const {
    companyId,
    query = {},
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { message: "companyId is undefined!" } });
  try {
    const orders = await Order.find({
      companyId,
      ...query,
      createdAt: { $gte: start_date, $lte: end_date },
    }).populate("driverId").populate("stations.id").sort({"createdAt": -1});
    const refactorOrder = [];
    await Promise.all(
      orders?.map(
        async (order, i) => {
          const order1 = {...order._doc};
          delete order1.stations
          await Promise.all(order?.stations?.map( async (station) => {            
            refactorOrder.push({...order1, station})
            return null
          }))
          return null
        }
      )
    )
    res.status(200).json({ success: true, data: refactorOrder });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateOrder = async (req, res) => {
  const { id, data } = req.body;
  // check id
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { message: "id is undefined!" } });
    // check data and typeof data
  if (!data || typeof data != "object")
    return res.status(200).json({
      success: false,
      error: { message: "data should be object and not undefined!" },
    });
  try {
    // check if the order exists by the specific id
    const order = await Order.findById(id)
    if (!order)
      return res.status(200).json({
        success: false,
        error: { message: "No such order with id found!" },
      });
      // check if the company id of the specific order and the one of the user matches or not
      if(order?.companyId != req.user.companyId._id) return createError(res, 400, "This order is not generated by your company")
      // if order.companyId matches then update the order
    res.status(200).json({
      success: true,
      data: { msg: `Order has been successfully updated!`, order },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const generateAndMailOrdersReport = async (req, res) => {
  const {
    stationId,
    email,
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
    query = {},
    isPdf = true,
  } = req.body;
  if (!stationId)
    return res
      .status(200)
      .json({ success: false, error: { message: "stationId is undefined!" } });
  if (!email)
    return res
      .status(200)
      .json({ success: false, error: { message: "email is undefined!" } });
  res.status(200).json("Kindly check you email!");
  res.end();
  try {
    const orderData = await Order.find({
      stations: { $elemMatch: { id: stationId } },
      ...query,
      createdAt: { $gte: start_date, $lte: end_date },
    });
    const title = `Station Orders`;
    let file;
    let filename = "Station_Order_Report";
    if (!isPdf) {
      file = await pdfReport.generateExcelSheet(orderData);
      filename += ".xlsx";
    } else {
      file = await pdfReport.pdfSetup(title, orderData);
      filename += ".pdf";
    }
    console.log("File generated!");
    const resultFile = fs.readFileSync(file);
    const fileUploadURL = await firebase_methods.uploadFile(
      stationId,
      resultFile
    );
    console.log("File uploaded to firebase storage!");
    const mail_text = `Attached is your Order Report for station with ${stationId}.`;
    const subject = "Wagoodi: Station Order Report";
    const otherData = {
      attachments: [
        {
          filename: filename,
          path: fileUploadURL,
        },
      ],
    };
    await sendMail(email, subject, mail_text, otherData);
    console.log(`Station Report send to ${email}`);
  } catch (error) {
    console.log(error);
  }
};

const driverAcceptOrder = async (req, res) => {
  const { location, orderId } = req.body;
  const { _id: driverId } = req.user;
  if (!location)
    return res.status(400).json({
      success: false,
      error: { message: "location field is undefined!" },
    });
  if (!orderId)
    return res.status(400).json({
      success: false,
      error: { message: "orderId field is undefined!" },
    });
  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order)
      return res.status(400).json({
        success: false,
        error: { message: "order with such id not found!" },
      });
    if (order.driverId)
      return res.status(400).json({
        success: false,
        error: { message: "driver already assigned for this order!" },
      });
    const driverTruck = await TruckModel.findOne({ driverId });
    if (!driverTruck || driverTruck.capacity < order.fuel_value)
      return createError(
        res,
        400,
        "driver truck capacity is lower then the order fuel!"
      );
    order.driverId = driverId;
    const orderAssigned = await order.save();
    return res.status(200).json({
      succes: true,
      data: {
        data: orderAssigned,
        msg: "Driver assigned to the given order!",
      },
    });
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { message: error?.msg || error } });
  }
};

const driverAssignOrder = async (req, res) => {
  const { id, driverId, location } = req.body;
  const existingRejectionEntry = await DriverRejectedModel.findOne({ order: id, driverId: driverId });
  if (existingRejectionEntry) {
    return res.status(400).json({ error: 'This order has been rejected by the driver' });
  }

  const canceledEnrty = await Order.findOne({ _id: id, status: 5 });
  if (canceledEnrty) {
    return res.status(400).json({ error: 'This order has been canceled by the driver' });
  }

  const io = req?.app?.io
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { message: "id undefined!" } });
  if (!driverId)
    return res
      .status(200)
      .json({ success: false, error: { message: "driverId undefined!" } });
  try {
    const driver = await Account.findById(driverId);
    if (!driver)
      return res.status(200).json({
        success: false,
        error: { message: "driver with such id not found!" },
      });
    // if (driver.on_going)
    //   return res.status(200).json({
    //     success: false,
    //     error: { message: "Driver already have an order to complete!" },
    //   });
    var selectedOption;

    const order = await Order.findOne({ _id: id });
    console.log('order', order);
    
    const selectedOrder = order.from;
    
    if (selectedOrder.option === 0) {
      // Run query on Vendor model
      selectedOption = await Vendor.findById(selectedOrder.vendorId);
    } else if (selectedOrder.option === 1) {
      // Run query on Station model
      selectedOption = await Station.findById(selectedOrder.stationId);
    }
    
     if (!order)
      return res.status(200).json({
        success: false,
        error: { message: "Order with such id not found!" },
      });
      console.log(typeof order.companyId)
      console.log(driver.companyId)
      console.log(order.companyId == driver.companyId)
      if(!order.companyId.equals(driver.companyId)) return createError(res, 400, "order and driver company does not match!")
    const driverTruck = await TruckModel.findOne({ driverId });
    if(!driverTruck) return createError(res, 400, "driver has no truck under his arsenal!")
    if (driverTruck.capacity < order.fuel_value)
      return createError(
        res,
        400,
        "driver truck capacity is lower then the order fuel value!"
      );
    order.driverId = driverId;
    order.status = 1;
    const tracking = await new Tracking({
      driverId,
      orderId: id,
      location,
    }).save();
    order.trackingId = tracking._id;
    order.startedAt ? (order.startedAt = Math.floor(Date.now() / 1000)) : "";
    order.canceled ? (order.canceled = null) : "";
    await order.save();
    // driver.on_going = true;
    await driver.save();
    res.status(200).json({
      success: true,
      data: { tracking, updateOrder, selectedOption, msg: "Order Successfully Assigned!" },
    });
    res.end();
    // const notificationDesc = `${Order._id} has been assigned to driver ${req.user.name}!`;
    // await Promise.all(
    //   order.stations.map(async ({ id: stationId }) => {
    //     const notification = await new Notification({
    //       orderId: order._id,
    //       companyId: order.companyId,
    //       type: 1,
    //       description: notificationDesc,
    //       accountId: driverId,
    //       stationId: stationId,
    //     }).save();
    //     io.to("/admin")
    //       .to("/companyAdmin-" + order.companyId)
    //       .to("/orderManager-" + order.companyId)
    //       .to("/stationManager-" + stationId)
    //       .to("/driver-" + driverId)
    //       .emit("notification-message", notification);
    //   })
    // );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message)
  }
};


const driverRejectOrder = async (req, res) => {
  try {
    const { orderId, driverId } = req.body;

    // Check if the combination of orderId and driverId already exists in the DriverRejectedModel
    const existingRejectionEntry = await DriverRejectedModel.findOne({ order: orderId, driverId: driverId });

    if (existingRejectionEntry) {
      return res.status(400).json({ error: 'Order has already been rejected by the driver' });
    }

    // Find the order by orderId and update its status to 0
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      { $set: { status: 0 } },
      { new: true } // Return the updated order
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Add the rejection information to the DriverRejectedModel
    const description = `Order with orderId: ${orderId} has been rejected by driver: ${driverId}`;
    const rejectionEntry = new DriverRejectedModel({
      driverId: driverId,
      order: orderId,
      description: description,
    });

    // Save the rejection entry to the database
    const savedRejectionEntry = await rejectionEntry.save();

    // Optionally, you can send the saved entry and the updated order back to the client or perform other actions
    res.status(200).json({ message: 'Order rejected successfully', data: { updatedOrder, savedRejectionEntry } });
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const driverCancelOrder = async (req, res) => {
  try {
    const { orderId, driverId } = req.body;

    // Check if the order has been assigned to the specific driver (status is 1 and driverId is the same)
    const assignedOrder = await Order.findOne({ _id: orderId, status: 1, driverId: driverId });

    if (!assignedOrder) {
      return res.status(403).json({ error: 'Order cannot be canceled by this driver' });
    }

    // Find the order by orderId and update its status to 5 (or any other status code you use for canceled orders)
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      { $set: { status: 5 } },
      { new: true } // Return the updated order
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Optionally, you can send the saved entry and the updated order back to the client or perform other actions
    res.status(200).json({ message: 'Order canceled successfully', data: { updatedOrder } });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



const getDriverOrderReciept = async (req, res) => {
  const { driverId, orderId } = req.body;
  if (!driverId)
    return res
      .status(200)
      .json({ success: false, error: { message: "driverId undefined!" } });
  if (!orderId)
    return res
      .status(200)
      .json({ success: false, error: { message: "orderId undefined!" } });
  try {
    const driver = await Account.findById(driverId);
    if (!driver)
      return res.json({
        success: false,
        error: { message: "No data of such driver found!" },
      });
    const order = await Order.findOne({ _id: orderId });
    if (!order)
      return res
        .status(200)
        .json({ success: false, error: { message: "No such order found!" } });
    if (order.driverId != driverId)
      return res.status(200).json({
        success: false,
        error: { message: "Driver is not assigned such order!" },
      });
    const attachment = order.attachments.find(
      ({ name }) => name == "driver-receipt"
    );
    res
      .status(200)
      .json({ success: true, data: { attachment: order.attachments[0] } });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const driverRecievedOrder = async (req, res) => {
  const { driverId, orderId, stationId } = req.body;
  const attachment = req.file.buffer;
  const mimetype = req?.file?.mimetype;
  const io = req?.app?.io
  if (!attachment)
    return res.status(200).json({
      success: false,
      error: { message: "attachment file is required!" },
    });
  if (!driverId)
    return res
      .status(200)
      .json({ success: false, error: { message: "driverId undefined!" } });
  if (!orderId)
    return res
      .status(200)
      .json({ success: false, error: { message: "orderId undefined!" } });
  try {
    const driver = await Account.findById(driverId);
    if (!driver)
      return res.json({
        success: false,
        error: { message: "No data of such driver found!" },
      });
    const order = await Order.findOne({
      _id: orderId,
      stations: { $elemMatch: { id: stationId } },
    }).populate("stations.id");
    if (!order)
      return res.status(200).json({
        success: false,
        error: { message: `No such order found! For stationId ${stationId}` },
      });
    if (order.driverId != driverId)
      return res.status(200).json({
        success: false,
        error: { message: "Driver is not assigned such order!" },
      });
    const attachmentName = "driver-receipt";
    const attachmentUrl = await firebase_methods.uploadOrderAttachment(
      order.companyId,
      attachmentName,
      attachment,
      mimetype
    );
    order.status = 2;
    const stations = order.stations;
    console.log("station for order : ", stations);
    let stationName;
    const stationsData = await Promise.all(
      stations.map((station) => {
        if (station?.id?._id != stationId) return station;
        station.status = 2;
        stationName = station?.id?.name;
        return station;
      })
    );
    order.attachments = [
      ...order.attachments,
      { name: attachmentName, url: attachmentUrl, stationId: stationId },
    ];
    order.stations = stationsData;
    await order.save();
    res.status(200).json({ success: true, data: order });
    res.end();
    const notificationDesc = `${Order._id} for station ${stationName} has been recieved by driver ${req.user.name}!`;

    const notification = await new Notification({
      orderId: order._id,
      companyId: order.companyId,
      type: 1,
      description: notificationDesc,
      stationId: stationId,
    }).save();
    io.to("/admin")
      .to("/companyAdmin-" + order.companyId)
      .to("/orderManager-" + order.companyId)
      .to("/stationManager-" + stationId)
      .to("/driver-" + driverId)
      .emit("notification-message", notification);
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const driverDelieveredOrder = async (req, res) => {
  const { driverId, orderId, stationId } = req.body;
  const io = req?.app?.io
  if (!driverId)
    return res
      .status(200)
      .json({ success: false, error: { message: "driverId undefined!" } });
  if (!orderId)
    return res
      .status(200)
      .json({ success: false, error: { message: "orderId undefined!" } });
  try {
    const driver = await Account.findById(driverId);
    if (!driver)
      return res.json({
        success: false,
        error: { message: "No data of such driver found!" },
      });
    const order = await Order.findOne({
      _id: orderId,
      stations: { $elemMatch: { id: stationId } },
    }).populate("stations.id");

    if (!order)
      return res.status(200).json({
        success: false,
        error: { message: `No such order found for stationId ${stationId}!` },
      });
    if (order.driverId != driverId)
      return res.status(200).json({
        success: false,
        error: { message: "Driver is not assigned such order!" },
      });
    order.status = 3;
    const stations = order.stations;
    let stationName;
    let stationsData = await Promise.all(
      stations.map((station, index) => {
        if (station?.id?._id != stationId) return station;
        station.status = 3;
        const currentTime = Math.floor(Date.now() / 1000);
        const previousTime = station?.pickedAt
          ? station.pickedAt
          : order.startedAt;
        const deliveryTime = currentTime - previousTime;
        station.deliveryTime = deliveryTime;
        stationName = station?.id?.name;
        return station;
      })
    );
    order.stations = stationsData;
    await order.save();
    driver.on_going = false;
    await driver.save();
    res.status(200).json({ success: true, data: order });
    res.end();
    const notificationDesc = `${Order._id} has been delievered to station ${stationName} by driver ${req.user.name}!`;
    // await Promise.all(
    //   order.stations.map(async ({ id: stationId }) => {
    const notification = await new Notification({
      orderId: order._id,
      companyId: order.companyId,
      type: 1,
      description: notificationDesc,
      accountId: driverId,
      stationId: stationId,
    }).save();
    io.to("/admin")
      .to("/companyAdmin-" + order.companyId)
      .to("/orderManager-" + order.companyId)
      .to("/stationManager-" + stationId)
      .to("/driver-" + driverId)
      .emit("notification-message", notification);
    // })
    // );
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// individual station order complete
const stationManagerCompleteOrder = async (req, res) => {
  const { stationManagerId, orderId, fuel_recieved } = req.body;
  const attachment = req.file.buffer;
  const mimetype = req?.file?.mimetype;
  const io = req?.app?.io
  const stationId = req.user.stationId._id;
  if (!stationId)
    return res.status(200).json({
      success: false,
      error: { message: `no station id found for user!` },
    });
  if (!stationManagerId)
    return res.status(200).json({
      success: false,
      error: { message: "stationManagerId undefined!" },
    });
  if (!orderId)
    return res
      .status(200)
      .json({ success: false, error: { message: "orderId undefined!" } });
  if (!attachment)
    return res.status(200).json({
      success: false,
      error: { message: "attachment file undefined!" },
    });
  try {
    const stationManager = await Account.findById(stationManagerId);
    if (!stationManager)
      return res.json({
        success: false,
        error: { message: "No data of such stationManager found!" },
      });
    const order = await Order.findOne({
      _id: orderId,
      stations: { $elemMatch: { id: stationId } },
    }).populate("stations.id");
    if (!order)
      return res.status(200).json({
        success: false,
        error: { message: `No such order found for stationId ${stationId}!` },
      });
    console.log("order station : ");
    const orderStations = order.stations;
    const orderStationsLength = order.stations.length;
    let stationIndex;
    await Promise.all(
      orderStations.findIndex(
        (station) => station?.id?.managerId == stationManagerId
      )
    ).then((value) => {
      stationIndex = value;
    });
    if (!stationIndex || stationIndex === -1)
      return res.status(200).json({
        success: false,
        error: {
          msg: "stationManagerId does not match with any station mentioned for an order!",
        },
      });
    let stationPrevName;
    let stationNextName;
    let stationNextId;
    let orderFullyComplete = false;
    const stationsData = await Promise.all(
      orderStations.map(async (station, index) => {
        if (index - 1 == stationIndex) {
          stationNextId = station.id._id;
          station.status = 1;
          stationNextName = station.id.name;
        }
        if (station.id._id != stationId) return station;
        station.status = 4;
        station.fuel_recieved = fuel_recieved;
        stationPrevName = station?.id?.name;
        await Fuel.findOneAndUpdate(
          { type: order.fuel_type },
          { $inc: { value: station?.fuel_value } }
        );
        if (index == orderStationsLength - 1) {
          order.status = 3;
          await Account.findByIdAndUpdate(order.driverId, { on_going: false });
          orderFullyComplete = true;
        }
        return station;
      })
    );
    const attachmentName = "manager-receipt";
    const attachmentUrl = await firebase_methods.uploadOrderAttachment(
      order.companyId,
      attachmentName,
      attachment,
      mimetype
    );
    order.attachments = [
      ...order.attachments,
      { name: attachmentName, url: attachmentUrl, stationId },
    ];
    order.fuel_recieved = fuel_recieved;
    order.stations = stationsData;
    await order.save();
    res.status(200).json({ success: true, data: order });
    res.end();
    const notificationDesc = `${Order._id} has been recieved by stationManager ${req.user.name} for station ${stationPrevName}!`;
    const notificationDesc2 = !orderFullyComplete
      ? `${Order._id} has been assigned to driver to deliever to station ${stationNextName}!`
      : `Order ${Order._id} has been completely deliver to all station by driver ${order.driverId} `;

    // await Promise.all(
    //   order.stations.map(async ({ id: stationId }) => {
    const notification = await new Notification({
      orderId: order._id,
      companyId: order.companyId,
      type: 1,
      description: notificationDesc,
      accountId: order.driverId,
      stationId: stationId,
    }).save();
    io.to("/admin")
      .to("/companyAdmin-" + order.companyId)
      .to("/orderManager-" + order.companyId)
      .to("/stationManager-" + stationId)
      .to("/driver-" + order.driverId)
      .emit("notification-message", notification);

    const notification2 = await new Notification({
      orderId: order._id,
      companyId: order.companyId,
      type: 1,
      description: notificationDesc2,
      accountId: order.driverId,
      stationId: stationNextId,
    }).save();
    io.to("/admin")
      .to("/companyAdmin-" + order.companyId)
      .to("/orderManager-" + order.companyId)
      .to("/stationManager-" + stationNextId)
      .to("/driver-" + order.driverId)
      .emit("notification-message", notification2);
    //   })
    // );
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const orderManagerCompletedOrder = async (req, res) => {
  const { managerId, orderId } = req.body;
  const io = req?.app?.io
  if (!managerId)
    return res
      .status(400)
      .json({ success: false, error: { message: "managerId is undefined!" } });
  if (!orderId)
    return res
      .status(400)
      .json({ success: false, error: { message: "orderId is undefined!" } });

  try {
    const order = await Order.findById(orderId);
    if (!order)
      return res.status(400).json({
        success: false,
        error: { message: "No order found with such orderId!" },
      });
    const isManagerValid = order.managerId == managerId;
    if (!isManagerValid)
      return res.status(400).json({
        success: false,
        error: { message: "You are not order manager for this order!" },
      });
    order.status = 4;
    await order.save();
    const notificationDesc = `Order with id ${orderId} is marked as completeted!`;
    res.status(200).json({ success: true, data: { msg: notificationDesc } });
    res.end();
    const notification = await new Notification({
      orderId,
      description: notificationDesc,
      companyId: order.companyId,
    }).save();
    io.to("/admin")
      .to("/companyAdmin-" + order.companyId)
      .to("/orderManager-" + order.companyId)
      .emit("notification-message", notificationDesc);
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { message: error?.msg || error } });
  }
};

const ManagerCompleteOrder = async (req, res) => {
  const { stationManagerId, orderId, fuel_recieved } = req.body;
  const attachment = req.file.buffer;
  const mimetype = req?.file?.mimetype;
  const io = req?.app?.io

  if (!stationManagerId)
    return res.status(200).json({
      success: false,
      error: { message: "stationManagerId undefined!" },
    });
  if (!orderId)
    return res
      .status(200)
      .json({ success: false, error: { message: "orderId undefined!" } });
  if (!attachment)
    return res.status(200).json({
      success: false,
      error: { message: "attachment file undefined!" },
    });
  try {
    const stationManager = await Account.findById(stationManagerId);
    if (!stationManager)
      return res.json({
        success: false,
        error: { message: "No data of such stationManager found!" },
      });
    const order = await Order.findOne({ _id: orderId }).populate("stations.id");
    if (!order)
      return res
        .status(200)
        .json({ success: false, error: { message: "No such order found!" } });
    console.log("order station : ");
    const orderStationManager = order?.stations[0].id?.managerId;
    if (orderStationManager != stationManagerId)
      return res.status(200).json({
        success: false,
        error: {
          msg: "stationManagerId does not match with order of the station!",
        },
      });
    const attachmentName = "manager-receipt";
    const attachmentUrl = await firebase_methods.uploadOrderAttachment(
      order.companyId,
      attachmentName,
      attachment,
      mimetype
    );
    order.status = 4;
    order.attachments = [
      ...order.attachments,
      { name: attachmentName, url: attachmentUrl },
    ];
    order.fuel_recieved = fuel_recieved;
    await order.save();
    res.status(200).json({ success: true, data: order });
    res.end();
    const notificationDesc = `${Order._id} has been recieved by driver ${req.user.name}!`;

    await Promise.all(
      order.stations.map(async ({ id: stationId }) => {
        const notification = await new Notification({
          orderId: order._id,
          companyId: order.companyId,
          type: 1,
          description: notificationDesc,
          accountId: order.driverId,
          stationId: stationId,
        }).save();
        io.to("/admin")
          .to("/companyAdmin-" + order.companyId)
          .to("/orderManager-" + order.companyId)
          .to("/stationManager-" + stationId)
          .to("/driver-" + order.driverId)
          .emit("notification-message", notification);
      })
    );
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateOrderLocation = async (req, res) => {
  const { id, location, driverId } = req.body;
  if (!id)
    return res
      .stataus(200)
      .json({ success: false, error: { message: "id undefined!" } });
  if (!location)
    return res
      .stataus(200)
      .json({ success: false, error: { message: "location undefined!" } });
  if (!driverId)
    return res
      .stataus(200)
      .json({ success: false, error: { message: "driverId undefined!" } });
  try {
    const tracking = await Tracking.findById(id);
    if (!tracking)
      return res.status(200).json({
        success: false,
        error: { message: "No such tracking record found!" },
      });
    if (driverId != tracking.driverId)
      return res.status(200).json({
        success: false,
        error: { message: "Such tracking don't belong to a driver!" },
      });
    tracking.location = location;
    await tracking.save();
    res.status(200).json({ success: true, data: tracking });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message.msg });
  }
};

const cancelOrder = async (req, res) => {
  const { reason, orderId } = req.body;
  const io = req?.app?.io

  if (!reason)
    return res
      .status(400)
      .json({ success: false, error: { message: "reason is undefined!" } });
  if (!orderId)
    return res
      .status(400)
      .json({ success: false, error: { message: "orderId is undefined!" } });
  const { role, _id: userId } = req.user;
  if (role != 2 || role != 4)
    return res.status(400).json({
      success: false,
      error: { message: "User not privilage to cancel an order!" },
    });
  try {
    const order = await Order.findById(orderId);
    if (!order)
      return res.status(400).json({
        success: false,
        error: { message: "No order found with such orderId!" },
      });
    if (role == 4 && order.driverId != userId)
      return res.status(400).json({
        success: false,
        error: { message: "You are not assigned for this order!" },
      });
    if (role == 2 && order.managerId != userId)
      return res.status(400).json({
        success: false,
        error: { message: "You are not an order Manager for this order!" },
      });
    if (order?.status == 5)
      return res.status(400).json({
        success: false,
        error: { message: "Order is canceled by Order Manager!" },
      });
    let canceledObj = { reason, role, userId };
    order.canceled = canceledObj;
    role == 2 ? (order.status = 5) : "";
    await order.save();
    res.status(200).json({
      success: true,
      data: { order, msg: "Order successfully cancelled" },
    });
    let notificationDesc = ``;
    if (role == 2) {
      notificationDesc = `Order ${orderId} has been cancelled by Order Manager ${userId}`;
    } else {
      notificationDesc = `Order ${orderId} has been cancelled by a driver ${userId}`;
      const notification = await new Notification({
        orderId,
        description: notificationDesc,
        type: 1,
        companyId: order.companyId,
        accountId: order.driverId,
      }).save();
      io.to("/companyAdmin-" + order.companyId)
        .to("/admin")
        .to("/orderManager-" + order.orderManagerId)
        .to("/driver-" + order.driverId)
        .emit("notification-message", notification);

      notificationDesc = `Accept or Reject Order ${order._id}?`;
      const driverNotification = await new Notification({
        orderId,
        description: notificationDesc,
        type: 2,
        companyId: order.companyId,
      }).save();
      io.to(`/company/drivers-${order.companyId}`).emit(
        "notification-message",
        { notification: driverNotification, order }
      );
      return;
    }

    await Account.findOneAndUpdate(
      { _id: order.driverId },
      { on_going: false }
    );
    await Promise.all(
      order.stations.map(async (station) => {
        const notification = await new Notification({
          orderId,
          description: notificationDesc,
          type: 1,
          companyId: order.companyId,
          accountId: order.driverId,
          stationId: station.id,
        }).save();
        io.to("/stationManager-" + station.id, notification);
      })
    );

    const notification = new Notification({
      orderId,
      description: notificationDesc,
      type: 1,
      companyId: order.companyId,
    }).save();
    io.to("/orderManager-" + order.managerId)
      .to("/companyAdmin-", order.companyId)
      .emit(notification);
    return;
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { message: error?.msg || error } });
  }
};

module.exports = {
  stationOrders,
  createOrder,
  getOrder,
  allCompanyQueryOrders,
  queryOrder,
  updateOrder,
  generateAndMailOrdersReport,
  driverAssignOrder,
  getDriverOrderReciept,
  updateOrderLocation,
  driverRecievedOrder,
  ManagerCompleteOrder,
  driverDelieveredOrder,
  stationManagerCompleteOrder,
  orderManagerCompletedOrder,
  driverAcceptOrder,
  cancelOrder,
  driverGetOrders,
  driverRejectOrder,
  driverCancelOrder
};
