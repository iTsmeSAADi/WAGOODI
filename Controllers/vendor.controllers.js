const Fuel = require("../Models/Fuel.schema");
const Vendor = require("../Models/Vendor.schema");
const { createError, successMessage } = require("../Utils/responseMessage");

const getAllVendors = async (req, res) => {
  const { query = {} } = req.body;
  try {
    const vendors = await Vendor.find({ ...query }).populate("fuels");
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const getCompanyVendors = async (req, res) => {
  const { companyId, query = {} } = req.body;
  delete query?.companyId;
  delete query?._id;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId undefined" } });
  try {
    const vendors = await Vendor.find({ companyId, ...query }).populate("fuels");
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const createVendor = async (req, res) => {
  const { companyId, name, address, fuels } = req.body;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId is undefined!" } });
  if (!name)
    return res
      .status(200)
      .json({ success: false, error: { msg: "name is undefined!" } });
  if (!address)
    return res
      .status(200)
      .json({ success: false, error: { msg: "address is undefined!" } });
  if (!fuels)
    return res
      .status(200)
      .json({ success: false, error: { msg: "fuels is undefined!" } });
  if (!Array.isArray(fuels))
    return res.status(200).json({
      success: false,
      error: { msg: "fuels must be array of object!" },
    });
  try {
    const checkFuelArr = await fuels?.filter(
      ({ type, price_litre }) =>
        (type || type == 0) &&
        typeof type === "number" &&
        price_litre &&
        typeof price_litre === "number"
    );
    if (checkFuelArr.length !== fuels.length)
      return res.status(200).json({
        success: false,
        error: { msg: "fuels array validation checks failed!" },
      });
    const savedFuels = await Fuel.insertMany(fuels);
    let responseMessage = "";
    const fuelsId = await savedFuels.map ( ({_id}) => _id);
    if (fuelsId.length == 0)
      return res.status(200).json({
        success: false,
        error: { msg: "failed to store fuels for vendor!" },
      });
    if (fuelsId.length != fuels.length) responseMessage = "Some fuels failed to store! ";
    const vendor = await new Vendor({
      name,
      companyId,
      address,
      fuels: fuelsId,
    }).save();
    responseMessage += "Vendor Successfully Created!";
    res
      .status(200)
      .json({ success: true, data: { msg: responseMessage, data: vendor } });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const updateVendor = async (req, res) => {
  const { id, payload = {}, fuels } = req.body;
  delete payload?._id;
  delete payload?.companyId;
  if (!id)
    return res
      .status(200)
      .json({ success: false, error: { msg: "id is undefined!" } });
  if (!payload)
    return res
      .status(200)
      .json({ success: false, error: { msg: "payload is undefined!" } });
  if (fuels) {
    if (!Array.isArray(fuels))
      return res.status(200).json({
        success: false,
        error: { msg: "fuels must be array of object!" },
      });
    const checkFuelArr = await fuels?.filter(
      ({ type, price_litre }) =>
        type != undefined &&
        typeof type === "number" &&
        price_litre &&
        typeof price_litre === "number"
    );
    if (checkFuelArr.length !== fuels.length)
      return res.status(200).json({
        success: false,
        error: { msg: "fuels array validation checks failed!" },
      });
  }
  try {
    let vendor = await Vendor.findOne({_id: id});
    if (!vendor)
      return res.status(200).json({
        success: false,
        error: { msg: "Vendor with such id is not found!" },
      });
    if (fuels) {
      // for every _id we will check if none found then upsert true
      const fuelIds = await Promise.all(
        fuels.map(async (fuel) => {
          const { _id, ...fuelData } = fuel;
          const saveFuel = await Fuel.findOneAndUpdate(
            { _id },
            { ...fuelData },
            { upsert: true, new: true }
          );
          return saveFuel._id;
        })
      );
      payload.fuels = await Promise.all(
        [...vendor.fuels, ...fuelIds].filter(Boolean)
      );
    }
    vendorData = { ...vendor, ...payload };
    console.log("VendorUpdated Data : ", vendorData)
    const newVendor = await Vendor.findOneAndUpdate({_id: id}, vendorData);
    res.status(200).json({
      success: true,
      data: { msg: "Vendor Successfully Updated!", data: newVendor },
    });
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const deleteVendor = async (req, res) => {
  const {id} = req.params;
  if(!id) return createError(res, 400, "id of vendor in param is undefined!")
  try {
    const deletedVendor = await Vendor.findByIdAndDelete(id)
    if(!deletedVendor || deletedVendor == -1) return createError(res, 400, "vendor with such id doesnot exist!")
    successMessage(res, deletedVendor, "Vendor got successfully deleted!")
  } catch (error) {
    console.log(error)
    createError(res, 400, error.message)
  }
}

module.exports = {
  getAllVendors,
  getCompanyVendors,
  createVendor,
  updateVendor,
  deleteVendor
};
