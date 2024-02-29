const Station = require("../Models/Station.schema");
const Order = require("../Models/Order.schema");
const Sale = require("../Models/Sale.schema");

const Fuel = require("../Models/Fuel.schema");
const DaySale = require("../Models/DaySale.schema");
const DayOrder = require("../Models/DayOrder.schema");
const mongoose = require("mongoose");
const { createError, successMessage } = require("../Utils/responseMessage");
const EmptyTankModel = require("../Models/EmptyTank.schema");

const getCompanyStations = async (req, res) => {
  const { companyId } = req.body;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId is undefined!" } });
  try {
    const stations = await Station.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
        },
      },
      {
        $lookup: {
          from: "fuels",
          localField: "fuels",
          foreignField: "_id",
          as: "populatedFuels",
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { stationId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$stationId", "$stations"] },
              },
            },
            {
              $sort: { createdAt: -1 },
            },
            {
              $limit: 1,
            },
          ],
          as: "latestOrder",
        },
      },
      {
        $unwind: {
          path: "$_id",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          populatedFuels: { $first: "$populatedFuels" },
          latestOrder: { $first: "$latestOrder" },
          address: { $first: "$address" },
          phone: { $first: "$phone" },
          favorite: { $first: "$favorite" },
          latitude: { $first: "$latitude" },
          longitude: { $first: "$longitude" },
          createdAt: { $first: "$createdAt" },
          active: { $first: "$active" },
        },
      },
      {
        $match: {
          active: true, // Filter only active stations
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          address: 1,
          phone: 1,
          favorite: 1,
          createdAt: 1,
          latitude: 1,
          longitude: 1,
          active: 1,
          latestOrder: 1,
          populatedFuels: {
            $map: {
              input: "$populatedFuels",
              as: "fuel",
              in: {
                $mergeObjects: [
                  "$$fuel",
                  {
                    percentageDifference: {
                      $cond: {
                        if: { $eq: ["$$fuel.max_value", 0] },
                        then: 1, // Avoid division by zero
                        else: {
                          $abs: {
                            $divide: [
                              { $subtract: ["$$fuel.value", "$$fuel.max_value"] },
                              { $abs: "$$fuel.max_value" },
                            ],
                          },
                        },
                      },
                    },
                    isMinPercentageDifference: {
                      $eq: [
                        "$$fuel.percentageDifference",
                        {
                          $min: "$populatedFuels.percentageDifference",
                        },
                      ],
                    },
                    color: {
                      $switch: {
                        branches: [
                          {
                            case: { $lte: ["$$fuel.percentageDifference", 0.3] },
                            then: "#C93D33",
                          },
                          {
                            case: { $lte: ["$$fuel.percentageDifference", 0.5] },
                            then: "#6877DC",
                          },
                          {
                            case: { $gte: ["$$fuel.percentageDifference", 0.5] },
                            then: "#2EB100",
                          },
                        ],
                        default: "#000000",
                      },
                      
                      
                    },
                  },
                ],
              },
            },
          },
        },
      },
      
      {
        "$addFields": {
          "populatedFuels": {
            "$map": {
              "input": "$populatedFuels",
              "as": "fuel",
              "in": {
                "$mergeObjects": [
                  "$$fuel",
                  {
                    "color": {
                      "$cond": {
                        "if": { "$lte": ["$$fuel.percentageDifference", 0.3] },
                        "then": "#C93D33",
                        "else": {
                          "$cond": {
                            "if": { "$lte": ["$$fuel.percentageDifference", 0.5] },
                            "then": "#6877DC",
                            "else": "#2EB100"
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
      
    ]).exec();
    successMessage(res, stations, null);
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateStaionFuelDispenser = async (req, res) => {
  const { stationId, updateData } = req.body;

  try {
    // Check if stationId and updateData are provided
    if (!stationId || !updateData) {
      return res.status(400).json({
        success: false,
        error: { msg: "stationId or updateData is missing!" }
      });
    }

    // Find the station by stationId
    const station = await Station.findById(stationId);

    // Check if the station exists
    if (!station) {
      return res.status(404).json({
        success: false,
        error: { msg: "Station not found with the provided stationId" }
      });
    }

    // Update fuel values for the station
    for (const fuelUpdate of updateData) {
      const { fuelId, updatedValue, updatePriceLitre, updateType, updateMaxValue } = fuelUpdate;

      // Find the fuel by fuelId
      const fuel = await Fuel.findById(fuelId);

      // Check if the fuel exists
      if (!fuel) {
        return res.status(404).json({
          success: false,
          error: { msg: "Fuel not found with the provided fuelId" }
        });
      }

      // Update the fuel value for the station
      const index = station.fuels.findIndex((f) => f.equals(fuelId));
      if (index !== -1) {
        station.fuels[index] = fuelId;
        fuel.value = updatedValue;
         fuel.price_litre = updatePriceLitre; 
         fuel.type = updateType;
         fuel.max_value = updateMaxValue;
        await fuel.save();
      }
    }

    // Save the updated station
    await station.save();

    // Fetch the updated data from the database
    const updatedStation = await Station.findById(stationId).populate('fuels');

    res.status(200).json({
      success: true,
      data: {
        message: "Fuel values updated successfully",
        updatedStation
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: error.message });
  }
};



const createStation = async (req, res) => {
  let { companyId, managerId, fuels, name, address, phone, latitude, longitude } = req.body;
  if (req.user.role !== 0) {
    companyId = req.user.companyId;
  }
  if (!companyId || !fuels || !name || !address)
    return res.status(200).json({
      success: false,
      error: { msg: "Required fields are undefined!" },
    });
    if(!latitude || !longitude)
    return res
      .status(200)
      .json({ success: false, error: { msg: "Both latitude and longitude are required!" } });
  
  if (!Array.isArray(fuels))
    return res.status(200).json({
      success: false,
      error: { msg: "fuels must be an array of object!" },
    });
  try {
    //create fuels record in database
    const fuelsId = await Promise.all(
      fuels.map(async (fuel) => {
        const { type, price_litre, value, max_value } = fuel;
        const savedFuel = await new Fuel({
          type,
          price_litre,
          value,
          max_value,
        }).save();
        return savedFuel._id;
      })
    );
    const station = await new Station({
      companyId,
      managerId,
      address,
      name,
      phone,
      latitude, 
      longitude,
      fuels: fuelsId,
    }).save();
    console.log(station);
    res.status(200).json({
      success: true,
      data: {
        msg: `${name} Station has successfully created!`,
        data: station,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateStation = async (req, res) => {
  const { stationId, updateData } = req.body;
  try {
    if (!stationId)
      return res
        .status(200)
        .json({ success: false, error: { msg: "stationId is undefined!" } });
    if (!updateData)
      return res
        .status(200)
        .json({ success: false, error: { msg: "updateData is undefined!" } });

    // Ensure 'favorite' is explicitly checked in updateData
    const { favorite, ...restUpdateData } = updateData;

    const updatedStation = await Station.findByIdAndUpdate(stationId, {
      ...restUpdateData,  // Spread the rest of the updateData
      favorite,          // Set the 'favorite' field
    });

    if (!updatedStation)
      return res.status(200).json({
        success: false,
        error: { msg: "No such station with id found" },
      });

    res.status(200).json({
      success: true,
      data: { msg: `${updatedStation.name} Station is updated!`, favorite: updateData.favorite },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const addStationFuelDispenser = async (req, res) => {
  const { payload } = req.body;

  try {
    if (!payload || !payload.max_value || !payload.price_litre || !payload.type || !payload.value) {
      throw new Error('Invalid payload. Please provide all required fields.');
    }

    const newFuel = new Fuel({
      max_value: payload.max_value,
      price_litre: payload.price_litre,
      type: payload.type,
      value: payload.value,
    });

    const savedFuel = await newFuel.save();

    res.status(201).json({ success: true, data: savedFuel });

  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, error: error.message });
  }
};



const listStations = async (req, res) => {
  try {
    const stations = await Station.find({})
      .populate("fuels")
      .populate("companyId");
    res.status(200).json({ success: true, data: stations });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const createStationSale = async (req, res) => {
  const { stationId: {_id: stationId}, companyId } = req.user;
  const { fuel_value, fuel_id } = req.body;
  console.log("stationID ", stationId)
  if (!fuel_value)
    return res
    .status(200)
      .json({ success: false, error: { msg: "fuel_value is not defined!" } });
  if (!fuel_id)
    return res.status(200).json({
      success: false,
      error: { msg: "fuel_id cannot be undefined!" },
    });
  try {
    const fuel = await Fuel.findOne({ _id: fuel_id });
    const calculateFinalFuel = fuel.value - fuel_value;
    if (calculateFinalFuel < 0)
      return res
        .status(200)
        .json({ success: false, error: { msg: "Not much fuel to transact!" } });
    await Fuel.findByIdAndUpdate(fuel_id, {
      $inc: { value: -parseInt(fuel_value) },
    });
    if (calculateFinalFuel == 0) {
      await new EmptyTankModel({
        companyId,
        stationId,
        fuelId: fuel._id,
      }).save();
    }
    const amount = fuel.price_litre * fuel_value;
    const sale = await new Sale({
      stationId,
      amount,
      fuel_value,
      fuel_type: fuel.type,
    }).save();
    res.status(200).json({
      success: true,
      data: { msg: "Sale created for a station!", data: sale },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const stationRecords = async (req, res) => {
  const { stationId, start_date = 0, end_date = Date.now() / 1000 } = req.body;
  if (!stationId)
    return res.status(200).json({
      success: false,
      error: { msg: "statiodId field is undefined!" },
    });
  try {
    const daySale = await DaySale.find({
      stationId,
      createdAt: { $lte: end_date, $gte: start_date },
    });
    const dayOrder = await DayOrder.find({
      stationId,
      createdAt: { $lte: end_date, $gte: start_date },
    });
    res.status(200).json({ success: true, data: { daySale, dayOrder } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const queryStation = async (req, res) => {
  const { query = {}, companyId } = req.body;
  delete query.companyId;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId undefined!" } });
  if (!query)
    return res
      .status(200)
      .json({ success: false, error: { msg: "query undefined!" } });
  try {
    const stations = await Station.find({ companyId, ...query })
      .populate("fuels")
      .populate("companyId");
    res.status(200).json({ success: false, data: stations });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

const stationSalesOrders = async (req, res) => {
  const {
    stationId,
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!stationId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "stationId not defined!" } });
  try {
    const sales = await Sale.find({
      stationId,
      createdAt: { $gte: start_date, $lte: end_date },
    });
    const orders = await Order.find({
      stations: { $elemMatch: { id: stationId } },
      createdAt: { $gte: start_date, $lte: end_date },
    });
    res.status(200).json({ success: true, data: { sales, orders } });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const stationSales = async (req, res) => {
  const { stationId, start_date, end_date } = req.body;
  if (!stationId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "stationId not defined!" } });
  try {
    const sales = await Sale.find({
      stationId,
      createdAt: { $gte: start_date, $lte: end_date },
    });
    res.status(200).json({ success: true, data: sales });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const getStation = async (req, res) => {
  const { id } = req.params;
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { msg: "id not defined!" } });
  try {
    const station = await Station.findById(id)?.populate("fuels");
    res.status(200).json({ success: true, data: station });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const adminQueryStation = async (req, res) => {
  const { query } = req.body;
  if (!query)
    return res
      .status(200)
      .json({ success: false, error: { msg: "query is undefined!" } });
  if (typeof query != "object")
    return res
      .status(200)
      .json({ success: false, error: { msg: "query should be object!" } });
  try {
    const station = await Station.find({ ...query }).populate("fuel");
    res.status(200).json({ success: true, data: station });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const midnightStationSale = async (req, res) => {
  const { saleCount, stationId, fuels } = req.body;
  if (!saleCount) return createError(res, 400, "saleCount is undefined!");
  if (!stationId) return createError(res, 400, "stationId is undefined!");
  if (!fuels) return createError(res, 400, "fuels is undefined!");
  if (!Array.isArray(fuels))
    return createError(res, 400, "fuels should be array object!");
  try {
    let date = new Date();
    date.setHours(0, 0, 0);
    date = Math.floor(date.getTime() / 1000);
    const station = await Station.findById(stationId).populate("fuels");
    if (!station)
      return createError(
        res,
        400,
        "station with such stationId was not found!"
      );
    const stationsFuels = station.fuels;
    const deactiveCurrentDaySales = () =>
      Sale.updateMany(
        { stationId, createdAt: { $gte: date } },
        { active: false }
      );
    const currentDaySale = await Sale.aggregate([
      {
        $match: { stationId, createdAt: { $gte: date } },
      },
      {
        $group: { _id: "$fuel_type", amount: { $sum: "$amount" } },
      },
    ]);

    const createManySale = fuels.map(async ({ fuel_type, value }) => {
      const fuel = stationsFuels.find((fuel) => fuel.type == fuel_type);
      const previousSaleAmount = currentDaySale.find(
        ({ _id }) => _id == fuel_type
      );
      const fuel_value = fuel.value - value + (previousSaleAmount || 0);
      const updateFuel = () =>
        Fuel.findByIdAndUpdate(fuel._id, { value: value });
      const amount = fuel.price_litre * fuel_value;
      const saveSale = () =>
        new Sale({
          stationId,
          amount,
          fuel_value,
          fuel_type,
        }).save();
      await Promise.all([updateFuel, saveSale]);
    });
    await Promise.all([deactiveCurrentDaySales, createManySale]);
    successMessage(
      res,
      null,
      "Sale for station were made and fuels value were updated!"
    );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const getStationEmptyTankFuel = async (req, res) => {
  const {
    stationId,
    query = {},
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!stationId) return createError(res, 400, "stationId is undefined!");
  try {
    const emptyTankFuels = await EmptyTankModel.find({
      stationId,
      ...query,
      createdAt: { $gte: start_date, $lte: end_date },
    }).populate("fuelId");
    successMessage(res, emptyTankFuels, null);
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const deleteCompanyStation = async (req, res) => {
  const { companyId, stationId } = req.query;
  if (!stationId) return createError(res, 400, "stationId is undefined!");
  try {
    const station = await Station.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(stationId),
      companyId,
    });
    if (!station)
      return createError(
        res,
        400,
        "Such station with stationId does not exist!"
      );
    successMessage(
      res,
      station,
      `Station ${station.name} is successfully deleted!`
    );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

module.exports = {
  createStation,
  updateStation,
  listStations,
  createStationSale,
  stationRecords,
  queryStation,
  getCompanyStations,
  stationSalesOrders,
  getStation,
  adminQueryStation,
  stationSales,
  midnightStationSale,
  getStationEmptyTankFuel,
  deleteCompanyStation,
  updateStaionFuelDispenser,
  addStationFuelDispenser
};
