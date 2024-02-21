const Company = require("../Models/Company.schema");
const Station = require("../Models/Station.schema");
const Account = require("../Models/Account.schema");
const mongoose = require("mongoose");
const { uploadCompanyFile } = require("../Utils/firebase");
const { sendMail } = require("../Utils/mail");
const { createError, successMessage } = require("../Utils/responseMessage");

const sendStatsReport = async (req, res) => {
  const { companyId } = req.body;
  const file = req.file;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId is undefined!" } });
  if (!file)
    return res
      .status(200)
      .json({ success: false, error: { msg: "file is undefined!" } });
  const filetypes = /jpeg|jpg|png|gif|pdf|xlsx/;
  const checkFileType = filetypes.test(file.mimetype);
  if (!checkFileType)
    return res.status(200).json({
      success: false,
      error: { msg: "file type is not of an image!" },
    });
  try {
    const companyAdminAccount = await Account.findOne({ companyId, role: 1 });
    if (!companyAdminAccount)
      return res.status(200).json({
        success: false,
        error: { msg: "No companyAdmin exist for such companyId!" },
      });
    const fileName = `${companyId}_stats`;
    const fileUrl = await uploadCompanyFile(fileName, file.buffer);
    res.status(200).json({
      success: true,
      data: {
        msg: "Check your email for statistics report!",
        data: { fileUrl },
      },
    });
    res.end();
    const { email } = companyAdminAccount;
    const subject = `Company Statistics Report || Wagoodi.`;
    const text = `Your company statistics file has been upload to the URL : ${fileUrl}`;
    sendMail(email, subject, text);
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { msg: error.message || error } });
  }
};

const individualDriverStats = async (req, res) => {
  const {
    id,
    status,
    start_date = Math.floor(Date.now() / 1000) - 2592000,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  const statusCond =
    status == undefined ? { status: { $exists: true } } : { status: status };
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { msg: "id is undefined!" } });
  try {
    const driverStats = await Account.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "driverId",
          as: "orders",
          //pipeline can be added here
        },
      },
      {
        $match: {
          $and: [
            { createdAt: { $gte: start_date, $lte: end_date } },
            { status: { $exists: true } },
          ],
        },
      },
      {
        $unwind: {
          path: "$orders",
        preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          deliveryTime: {
            $subtract: ["$orders.deliveredAt", "$orders.pickedAt"],
          },
        },
      },
      {
        $group: {
          _id: {
            driverId: "$_id",
            day: { $dayOfMonth: "$createdAt" },
            stationId: "$orders.stations.id",
          },
          name: { $first: "$name" },
          DailyOrders: {
            $push: {
              orderId: "$orders._id",
              date: "$orders.createdAt",
              deliveryTime: "$deliveryTime",
              to: "$orders.to",
              from: "$orders.from",
              status: "$orders.status",
              attachments: "$orders.attachments",
            },
          },
          trips: { $sum: 1 },
          avgDeliveryTime: { $avg: "$deliveryTime" },
        },
      },
    ]).exec();
    console.log("driver Stats: ", driverStats);
    res.status(200).json({ success: true, data: driverStats });
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { msg: error.message || error } });
  }
};

const driversStats = async (req, res) => {
  const {
    companyId,
    start_date = Math.floor(Date.now() / 1000) - 2592000,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId is undefined!" } });

  try {
    const driverStatistics = await Account.aggregate([
      {
        $match: {
          $and: [
            { companyId: new mongoose.Types.ObjectId(companyId) },
            { role: 4 },
          ],
        },
      },
      {
        $unwind: {
          path: "$_id",
        preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "driverId",
          as: "orders",
        },
      },
      {
        $match: {
          createdAt: { $gte: start_date, $lte: end_date },
        },
      },
      {
        $unwind: {
          path:"$orders.stations",
        preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          deliveryTime: {
            $subtract: ["$stations.deliveredAt", "$stations.pickedAt"],
          },
          month: { $month: "$orders.createdAt" },
        },
      },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          email: { $first: "$email" },
          month: { $first: "$month" },
          avgDeliveryTime: { $avg: "$deliveryTime" },
          trips: { $sum: "$orders" },
        },
      },
    ]).exec();
    console.log("Driver Stats: ", driverStatistics);
    res.status(200).json({ success: true, data: driverStatistics });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const stationStats = async (req, res) => {
  const {
    id,
    start_date = Math.floor(Date.now() / 1000) - 2592000,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { msg: "id is undefined!" } });
  try {
    const stationStatistics = await Station.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "dayorders",
          localField: "_id",
          foreignField: "stationId",
          as: "dayorders",
        },
      },
      {
        $match: {
          "dayorders.createdAt": { $gte: start_date, $lte: end_date },
        },
      },
      {
        $lookup: {
          from: "daysales",
          localField: "_id",
          foreignField: "stationId",
          as: "daysales",
        },
      },
      {
        $match: {
          "daysales.createdAt": { $gte: start_date, $lte: end_date },
        },
      },
      {
        $unwind: {
          path: "$dayorders",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$daysales",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          dayOrderDateMillis: { $multiply: ["$dayorders.createdAt", 1000] },
        },
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$dayOrderDateMillis" },
          },
          name: { $first: "$name" },
          stationId: { $first: "$_id" },
          totalOrder: { $sum: "$dayorders.quantity" }, // Change to the actual field in your dayorders collection
          totalSale: { $sum: "$daysales.quantity" }, // Change to the actual field in your daysales collection
          totalSaleAmount: { $sum: "$daysales.amount" },
          totalSaleFuel: { $sum: "$daysales.fuel_value" },
          totalOrderValue: { $sum: "$dayorders.amount" },
          totalOrderFuel: { $sum: "$dayorders.recieved_value" },
        },
      },
    ]).exec();
    
    console.log("stationStatistics : ", stationStatistics);
    successMessage(res, stationStatistics);
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const companyAllStats = async (req, res) => {
  const {
    companyId,
    start_date = Math.floor(Date.now() / 1000) - 2592000,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId is undefined!" } });
  try {
    const companyStat = await Company.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(companyId),
        },
      },
      {
        $lookup: {
          from: "stations",
          localField: "_id",
          foreignField: "companyId",
          as: "stations",
        },
      },
      {
        $unwind: {
          path: "$stations",
        preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "dayorders",
          localField: "stations._id",
          foreignField: "stationId",
          as: "dayorders",
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start_date, $lte: end_date },
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$dayorders",
        preserveNullAndEmptyArrays: true,
        }
      },
      {
        $addFields: {
          dayOrderDateMillis: { $multiply: ["$dayorders.createdAt", 1000] },
        },
      },
      {
        $lookup: {
          from: "daysales",
          localField: "stations._id",
          foreignField: "stationId",
          as: "daysales",
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start_date, $lte: end_date },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "stations._id",
          foreignField: "stations.id",
          as: "orders",
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start_date, $lte: end_date },
              },
            },
          ],
        },
      },
      {
        $unwind: {path:"$daysales",
        preserveNullAndEmptyArrays: true,
      }
      },
      {
        $unwind: {path: "$orders",
        preserveNullAndEmptyArrays: true,
      }
      },
      {
        $group: {
          _id: "$orders._id",
          trips: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            stationId: "$stations._id",
            month: { $month: "$dayOrderDateMillis" },
          },
          companyName: { $first: "$name" },
          stationName: { $push: "$stations.name" },
          drivers: { $push: "$drivers" },
          totalSaleAmount: { $sum: "$daysales.amount" }, // Calculate total sale amount
          totalOrderFuel: { $sum: "$dayorders.recieved_value" },
          totalOrderValue: { $sum: "$dayorders.amount" }, // Calculate total order value
          totalSaleFuel: { $sum: "$daysales.fuel_value" },
          totalTrips: { $sum: "$trips" },
          totalDeliveries: { $sum: "$trips" },
        },
      },
      {
        $group: {
          _id: companyId, // Group by the company ID
          companyName: { $first: "$companyName" },
          stations: { $push: "$stations" },
          totalSaleAmount: { $sum: "$totalSaleAmount" },
          totalOrderValue: { $sum: "$totalOrderValue" },
          monthlyData: {
            $push: {
              month: "$month",
              stationId: "$stationId",
              stationName: "$stationName",
              totalSaleAmount: "$totalSaleAmount",
              totalOrderValue: "$totalOrderValue",
              totalOrderFuel: "$totalOrderFuel",
              totalSaleFuel: "$totalSaleFuel",
              trips: "$totalTrips",
            },
          },
          totalDeliveries: { $sum: "$totalDeliveries" },
          totalStationCount: { $sum: 1 }, // Count the stations
        },
      },
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "companyId",
          as: "drivers",
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start_date, $lte: end_date },
                role: { $eq: 4 },
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          companyName: { $first: "$name" },
          stations: { $first: "$stations" },
          totalSaleAmount: { $first: "$totalSaleAmount" },
          totalOrderValue: { $first: "$totalOrderValue" },
          totalStations: { $first: "$totalStationCount" },
          monthlyData: { $first: "$monthlyData" },
          totalDrivers: { $sum: 1 },
        },
      },
    ]).exec();
    console.log("company Stat : ", companyStat);
    res.status(200).json({ success: true, data: companyStat });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

// DayOrder And DaySale totals.

module.exports = {
  companyAllStats,
  driversStats,
  stationStats,
  individualDriverStats,
  sendStatsReport,
};
