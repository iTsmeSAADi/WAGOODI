const Subscription = require("../Models/Subscriptions.schema");
const Product = require("../Models/Product.schema");
const Account = require("../Models/Account.schema");
const Company = require("../Models/Company.schema");
const { createError, successMessage } = require("../Utils/responseMessage");
const { default: mongoose } = require("mongoose");
const { addOnCharge, cancelSubscription } = require("../Utils/paypal");
const url = require("url")
const querystring = require("querystring")
// const { io } = require("../index");
const Notification = require("../Models/Notification.schema");
const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET_KEY;
const paypal = require("paypal-rest-sdk");
paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id: PAYPAL_CLIENT,
  client_secret: PAYPAL_SECRET,
});

const return_url = process.env.PAYPAL_RETURN_URL;
const cancel_url = process.env.PAYPAL_CANCEL_URL;

const createSubscription = async (req, res) => {
  const io = req?.app?.io;
  const {
    productId = "65d8996e8deb45917ee3aa17",
    start_date = new Date(),
    payment_method = "paypal",
    isTrial = false,
    numOfStations = 0,
  } = req.body;
  const user = req?.user;
  const {
    _id: accountId,
    companyId: { _id: companyId },
  } = user;
  if (!productId) return createError(res, 400, "productId is undefined!");
  if (!accountId) return createError(res, 400, "id of user is undefined!");
  try {
    const company = await Company.findOne({
      _id: new mongoose.Types.ObjectId(companyId),
    });
    if (!company)
      return createError(
        res,
        400,
        "No company with companyId found for a user!"
      );
    const product = await Product.findOne({
      _id: new mongoose.Types.ObjectId(productId),
    });
    if (!product)
      return createError(res, 400, "No such product found for a productId");
    const trialObj = isTrial
      ? {
          name: "Trial Period",
          type: "TRIAL",
          frequency: "DAY",
          frequency_interval: 30, // 30 days trial period
          amount: {
            value: "0.00", // amount for the trial period (could be 0.00 for free trial)
            currency: "USD",
          },
          cycles: 1, // number of trial cycles
        }
      : null;
    const {
      description,
      frequency_interval,
      currency,
      type,
      sub_type,
      station_quantity_charge,
      amount,
    } = product;
    console.log("PRODUCT : ", product);
    if (type == 1) {
      // if subscription is of type 'enterprise'
      const subscription = await new Subscription({
        subscriptionType: type,
        productId,
        companyId,
        accountId,
      }).save();
      console.log(subscription);
      company.allowedStations = numOfStations;
      company.subscriptionId = subscription._id;
      await company.save();
      const notification = await new Notification({
        description: `Company ${company.name} requesting for enterprise subscription!`,
        type: 0, // admin notification
        companyId: company._id,
        subscriptionId: subscription._id,
      }).save();
      io.to("admin").emit("notification-message", notification);
      return successMessage(
        res,
        subscription,
        "Subscription created successfully!"
      );
    }
    const stationPaymentObject =
      !isTrial && numOfStations > 0
        ? {
            name: "Total Station Payment",
            type: "REGULAR",
            frequency: "MONTH",
            frequency_interval: 1, // just once
            amount: {
              value: station_quantity_charge * numOfStations, // total amount of stations payment
              currency: currency || "USD",
            },
            cycles: 1, // charge only once
          }
        : null;
    const payment_definitions = [
      {
        name: "Regular Payment",
        type: "REGULAR",
        frequency: "MONTH",
        frequency_interval: frequency_interval, // billing every 3 months
        amount: {
          value: amount, // amount of payment
          currency: currency || "USD",
        },
        cycles: 0, // infinite amount of cycles
      },
    ];
    if (trialObj) payment_definitions.push(trialObj);
    if (stationPaymentObject) payment_definitions.push(stationPaymentObject);

    const billingPlanAttributes = {
      name: "Wagodi Monthly Subscription",
      description: description,
      type: "INFINITE",
      payment_definitions: payment_definitions,
      merchant_preferences: {
        auto_bill_amount: "yes",
        cancel_url: cancel_url,
        return_url: return_url,
      },
    };


    paypal.billingPlan.create(
      billingPlanAttributes,
      async (error, billingPlan) => {
        if (error) {
          console.log(error?.response?.details);
          return createError(
            res,
            400,
            error?.response?.details || "billing creation error!"
          );
        }
        var billingPlanUpdateAttributes = [
          {
            op: "replace",
            path: "/",
            value: {
              state: "ACTIVE",
            },
          },
        ];
        paypal.billingPlan.update(
          billingPlan.id,
          billingPlanUpdateAttributes,
          (error, response) => {
            if (error) {
              console.log(error?.response?.details);
              return createError(
                res,
                400,
                error?.response?.details || "billing Updation error!"
              );
            }
            start_date.setMinutes(new Date().getMinutes() + 10)

            const billingAgreementAttributes = {
              name: "Subscription Agreement",
              description:
                "Subscription agreement for the My Subscription Plan",
              start_date: new Date(start_date).toISOString(), // specify the start date for the subscription
              plan: {
                id: billingPlan.id,
              },
              payer: {
                payment_method: payment_method,
              },
            };
            paypal.billingAgreement.create(
              billingAgreementAttributes,
              async (error, billingAgreement) => {
                if (error) {
                  console.log(error?.response?.details);
                  return createError(
                    res,
                    400,
                    error?.response?.details || "billing Agreement Creation error!"
                  );
                }
                console.log("billingAgreement  : ",billingAgreement)
                const billingAgreementUrl = billingAgreement.links[0].href;
                const billingUrlString = url.parse(billingAgreementUrl)
                const queryParams = querystring.parse(billingUrlString.query)
                const token = queryParams.token
                // let tier;
                // switch (frequency_interval) {
                //   case 1:
                //     tier = 0;
                //     break;
                //   case 3:
                //     tier = 1;
                //     break;
                //   case 6:
                //     tier = 2;
                //     break;
                //   case 12:
                //     tier = 3;
                //     break;
                //   default:
                //     tier = 0;
                //     break;
                // }
                const subscription = await new Subscription({
                  sub_type,
                  start_date,
                  subscriptionType: type,
                  productId,
                  companyId,
                  accountId,
                  token,
                  billingPlanId: billingPlan.id,
                  // tier
                }).save();
                company.allowedStations = numOfStations;
                company.subscriptionId = subscription._id;
                await company.save();

                const requestOptions = {
                  method: "GET",
                  uri: billingAgreementUrl,
                };
                successMessage(res, requestOptions);
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const successSubscription = async (req, res) => {
  const { ba_token: token, company } = req.body;
  try {
    // Execute the billing agreement to start the subscription
    const executeAttributes = { payer_id: token };
    paypal.billingAgreement.execute(
      token,
      executeAttributes,
      async (error, executedAgreement) => {
        console.log("error ", error?.response?.details);
        console.log("executed Agreement  ", executedAgreement);
        if (error) {
          return createError(
            res,
            400,
            error?.response?.message || "billing creation error!"
          );
        }
        console.log("Billing Agreement Executed:");
        console.log(executedAgreement);
        let subscription = await Subscription.findOne({
          token
        });
        if (!subscription){
          console.log(
            "no subscription found in database with such billingAgreementId"
            );
            return createError(res, 400, "no subscription found with such billingAgreementId!")
          }
        subscription.active = true;
        subscription.billingAgreementId = executedAgreement.id;
        await subscription.save();
        const notification = await new Notification({
          description: `Company ${company.name} subscription created Successfully!`,
          type: 0, // admin notification
          companyId: company._id,
          subscriptionId: subscription._id,
        }).save();
        io.to("admin").emit("notification-message", notification);
        successMessage(res, null, "Successfully subscribed");
      }
    );
  } catch (error) {
    console.log(error);
    return createError(res, 400, error.message);
  }
};

const getCompanySubscription = async (req, res) => {
  const { companyId } = req.body;
  if (!companyId) return createError(res, 400, "companyId is not defined!");
  try {
    const subscription = await Subscription.find(
      { companyId },
      { sort: { _id: 1 } }
    );
    return successMessage(res, subscription);
  } catch (error) {
    console.log(error);
    return createError(res, 400, error.message);
  }
};

// only for superAdmin and can be changed for company with enterprise subscription.
const updateSubscription = async (req, res) => {
  const { companyId, productId } = req.body;
  if (!companyId) return createError(res, 400, "subscriptionId is undefined!");
  if (!productId) return createError(res, 400, "productId is undefined!");
  try {
    const subscription = await Subscription.findOne({ companyId });
    // we should check for subscription of enterprise and then update information of subscription regarding the data provided
    if (!subscription)
      return createError(
        res,
        400,
        "no subscription found for a company with this companyId!"
      );
    const newProduct = await Product.findOne({ _id: productId });
    if (!newProduct)
      return createError(res, 400, "No such product with productId is found!");
    const previousProduct = (await Product.findOne({
      _id: subscription.productId,
    })) || { amount: 0, station_quantity_charge: 0 };
    await updateCompaniesSubscriptions(
      newProduct,
      previousProduct,
      true,
      subscription
    ); // we should see for changes reflection
    successMessage(200, null, "Subscription updated successfully!");
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const adminEnterpriseSubscriptionUpdate = async (req, res) => {
  const { companyId, subscriptionId, updatedData } = req.body;
  if (!companyId) return createError(res, 400, "companyId is undefined!");
  if (!subscriptionId)
    return createError(res, 400, "subscriptionId is undefined!");
  if (!updatedData) return createError(res, 400, "updatedData is undefined!");
  let allowedStations = updatedData.stationsAmount;
  delete updatedData.stationsAmount;
  try {
    const company = await Company.findOne({ _id: companyId });
    if (!company)
      return createError(res, 400, "company with such companyId is not found!");
    let subscription = await Subscription.findOne({ _id: subscriptionId });
    if (!subscription)
      return createError(res, 400, "subscription is undefined!");
    subscription = { ...subscription, updatedData };
    await subscription.save();
    if (allowedStations) {
      company.allowedStations = allowedStations;
      await company.save();
    }
    successMessage(
      res,
      subscription,
      `Subscription for the company ${company.name} updated successfully!`
    );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

// charge company for addition number of stations.
const stationQuantityUpgrade = async (req, res) => {
  const { companyId, stationsAmount } = req.body;
  try {
    if (!companyId)
      return createError(res, 400, "no company found for such companyId");
    const subscription = await Subscription({ companyId })
      .populate("productId")
      .populate("companyId");
    if (!subscription)
      return createError(res, 400, "no subscription found for this company");
    if (!subscription.active || subscription.valid_until <= Date.now())
      return createError(res, 400, "subscription has expired! Kindly renew.");
    const { productId: product, companyId: company } = subscription;
    const { station_quantity_charge, currency } = product;
    const amount = station_quantity_charge * stationsAmount;
    const totalAllowedStations = company.allowedStations + stationsAmount;
    await addOnCharge(amount, currency, subscription.billingAgreementId);
    await Company.findByIdAndUpdate(companyId, {
      allowedStations: totalAllowedStations,
    });
    return successMessage(
      res,
      null,
      `Company stations limit increment to ${totalAllowedStations}`
    );
  } catch (error) {
    console.log(error);
    return createError(res, 400, error.message);
  }
};

const cancelCompanySubscription = async (req, res) => {
  const { companyId, reason = "User canceled for some reason!" } = req.body;
  if (!companyId) return createError(res, 400, "companyId is undefined!");
  try {
    const subscription = await Subscription.findOne({ companyId });
    if (!subscription)
      return createError(res, 400, "subscription for a company was not found!");
    await cancelSubscription(subscription.billingAgreementId, reason);
    subscription.active = false;
    await subscription.save();
    successMessage(
      res,
      null,
      `Company subscription was successfully cancelled!`
    );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const paypalSubscriptionDummy = async (req, res) => {
  // const {return_url} = req.body;
  try {
    const billingPlanAttributes = {
      name: "test",
      description: "testing description",
      type: "INFINITE",
      payment_definitions: [
        {
          name: "Regular Payment",
          type: "REGULAR",
          frequency: "MONTH",
          frequency_interval: 1, // billing every 3 months
          amount: {
            value: 12, // amount of payment
            currency: "USD",
          },
          cycles: 0, // infinite amount of cycles
        },
      ],
      merchant_preferences: {
        auto_bill_amount: "yes",
        cancel_url: cancel_url,
        return_url: return_url,
      },
    };

    paypal.billingPlan.create(
      billingPlanAttributes,
      async (error, billingPlan) => {
        var billingPlanUpdateAttributes = [
          {
            op: "replace",
            path: "/",
            value: {
              state: "ACTIVE",
            },
          },
        ];
        console.log("billingplan  : ", billingPlan);
        console.log("error: ", error);
        console.log("billingplan  error : ", error?.response?.details);
        const start_date = new Date();
        console.log("current date : ", start_date.getMinutes());
        start_date.setMinutes(new Date().getMinutes() + 10);
        console.log("updated start date : ", start_date.getMinutes());
        paypal.billingPlan.update(
          billingPlan.id,
          billingPlanUpdateAttributes,
          (error, response) => {
            const billingAgreementAttributes = {
              name: "Agreement",
              description: "Subscription Plan",
              start_date: start_date.toISOString(), // specify the start date for the subscription
              plan: {
                id: billingPlan.id,
              },
              payer: {
                payment_method: "paypal",
              },
            };
            paypal.billingAgreement.create(
              billingAgreementAttributes,
              (error, billingAgreement) => {
                // const { id: billingAgreementId } = billingAgreement
                console.log("Billing Agreement : ", billingAgreement);
                console.log("Billing Error : ", error?.response.details);
                const billingAgreementUrl = billingAgreement.links[0].href;
                console.log(billingAgreement);
                const requestOptions = {
                  method: "GET",
                  uri: billingAgreementUrl,
                };
                successMessage(res, requestOptions);
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const getAllCompany = async (req, res) => {
  const {isEnterprise} = req.body
  try {
    const companiesSubscriptions = await Subscription.find({subscriptionType: isEnterprise ? 1 : {$exists: true}}).populate("companyId").populate("productId").sort({createdAt: -1})
    successMessage(res, companiesSubscriptions)
  } catch (error) {
    console.log(error)
    createError(res, 400, error.message)
  }
}

module.exports = {
  cancelSubscription,
  getCompanySubscription,
  createSubscription,
  stationQuantityUpgrade,
  updateSubscription,
  successSubscription,
  cancelCompanySubscription,
  adminEnterpriseSubscriptionUpdate,
  paypalSubscriptionDummy,
  getAllCompany
};
