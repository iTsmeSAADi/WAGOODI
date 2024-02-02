const Product = require("../Models/Product.schema");
const { successMessage, createError } = require("../Utils/responseMessage");
const {updateCompaniesSubscriptions} = require("../Utils/paypal")

const createProduct = async (req, res) => {
    const {type, station_quantity_charge, frequency_interval, amount, sub_type, currency = "USD"} = req.body;
    if((type == undefined) || !station_quantity_charge || !frequency_interval || !amount) return createError(res, 400, "Required fields are undefined!")
    if(type == 0 && (sub_type == undefined))  return createError(res, 400, "sub_type is undefined!")
    try {  
            const product = await new Product({
                type,
                station_quantity_charge,
                frequency_interval,
                amount,
                currency,
                sub_type: sub_type
            }).save()

            return successMessage(res, product, "Product created successfully")
    } catch (error) {
        console.log(error)
        return createError(res, 400, error.message)
    }
}


const getProduct = async (req, res) => {
    const {productId} = req.params;
    if(!productId) return createError(res, 400, "productId is undefined!")
    try {
        const product = await Product.findOne({_id: productId})
        if(!product) return createError(res, 400, "No product found for such productId!")
        return successMessage(res, product)
    } catch (error) {
        console.log(error)
        return createError(res, 400, error.message)
    }
}


const getAllProduct = async (req, res) => {
    try {
        const products = await Product.find({})
        return successMessage(res, products)
    } catch (error) {
        console.log(error)
        return createError(res, 400, error.message)
    }
}

const updateProduct = async (req, res) => {
    const {productId, updatedData} = req.body
    if(!productId) return createError(res, 400, "productId is undefined!")
    if(!updatedData) return createError(res, 400, "updatedData is undefined!")
    delete updatedData?._id
    try {
        const previousProduct = await Product.findOne({_id: productId})
        const product = previousProduct;
        if(!product) return createError(res, 400, "No product found for such productId!")
        product = {...product, updatedData};
        // cron_job for updation of subscriptions related to productId.
        // subscription renew.
        const updatedProduct = await product.save();
        await successMessage(res, updatedProduct, "Product updated successfully!")
        res.end()
        await updateCompaniesSubscriptions(product, previousProduct)
        //call subscription data with updated product.
    } catch (error) {
        console.log(error)
        return createError(res, 400, error.message)
    }
}

const deleteProduct = async (req, res) => {
    const {productId} = req.body;
    if(!productId) return createError(res, 400, "productId is undefined!")
    try {
        const product = await Product.findByIdAndDelete(productId)
        return successMessage(res, null, "Product deleted successfully")
    } catch (error) {
        console.log(error)
        return createError(res, 400, error.message)
    }
}

module.exports = {
    createProduct,
    getProduct,
    updateProduct,
    deleteProduct,
    getAllProduct
}