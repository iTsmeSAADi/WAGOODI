const Account = require("../Models/Account.schema");
const TruckModel = require("../Models/Truck.schema")
const { createError, successMessage } = require("../Utils/responseMessage")


const createTruck = async (req, res) => {
    const {driverId, plate_number, capacity} = req.body;
    if(!driverId) return createError(res, 400, "driverId is undefined!")
    if(!plate_number) return createError(res, 400, "plate_number is undefined!")
    if(!capacity) return createError(res, 400, "capacity is undefined!")
    try {
        const driver = await Account.findById(driverId)
        if(!driver) return createError(res, 400, "driver not found with such driverId!")
        const truck = await new TruckModel({
            capacity,
            driverId,
            plate_number
        }).save()
        successMessage(res, {payload: truck}, "Truck successfully created and assigned to the driver!" )
    } catch (error) {
        createError(res, 400, error.message)
    }
}

const getDriverTrucks = async (req, res) => {
    const {driverId} = req.params;
    if(!driverId) return createError(res, 400, "driverId is undefined!")
    try {
        const driver = await Account.findById(driverId)
        if(!driver) return createError(res, 400, "driver with such driverId not found!")
        const driverTrucks = await TruckModel.find({driverId})
        successMessage(res, driverTrucks, null)
    } catch (error) {
        console.log(error)
        createError(res, 400, error.message)
    }
}

const updateTruck = async (req, res) => {
    const {truckId, updateData} = req.body;
    if(!truckId) return createError(res, 400, "truckId is undefined!")
    if(!updateData) return createError(res, 400, "updateData is not provided!")
    delete updateData._id
    try {
        let truck = await TruckModel.findOneAndUpdate({_id: truckId}, {...updateData})
        if(!truck) return createError(res, 400, "truck does not exist!")
        successMessage(res, {truck}, "truck updated successfully!")
    } catch (error) {
        console.log(error)
        createError(res, 400, error.message)
    } 
}

const deleteTruck = async (req, res) => {
    const {truckId} = req.body;
    if(!truckId) return createError(res, 400, "truckId is undefined!")
    try {
        const truck = await TruckModel.findByIdAndDelete(truckId)
        successMessage(res, null, "truck deleted successfully!")
    } catch (error) {
        console.log(error)
        createError(res, 400, error.message)
    }
}

module.exports = {
    getDriverTrucks,
    createTruck,
    updateTruck,
    deleteTruck
}