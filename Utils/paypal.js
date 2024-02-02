const { paypal }= require("../index")
const Subscription = require("../Models/Subscriptions.schema");

const updateCompaniesSubscriptions = async (product, previousProduct, isUpgradePackage = false, subscription) => {
  if (!product) throw new Error("product is undefined!");
  const {
    frequency_interval,
    amount,
    currency,
    description,
    _id: productId,
    station_quantity_charge,
  } = product;
  if (!frequency_interval || !amount || !currency)
    throw new Error("some fields for updating subscription are undefined!");

  const updatedSubscriptionObj = {
    frequency_interval,
    amount: {
      currency,
      total: amount,
    },
    description,
  };
  const subscriptions = isUpgradePackage ? [subscription] : await Subscription.find({ productId }).populate(
    "companyId"
  );
  await Promise.all(
    subscriptions.map(
      ({
        billingAgreementId,
        productId,
        companyId: company,
        active,
        valid_until,
        _id
      }) => {
        const { allowedStations, subscriptionType } = company;
        const extraStations = allowedStations - 10;
        const defaultStationAmount = Math.abs(station_quantity_charge * extraStations) // station 
        const previousStationAmount = Math.abs(previousProduct.station_quantity_charge * extraStations)
        const stationFinalAmount =  extraStations > 0 && subscriptionType != 3 ?  Math.abs(defaultStationAmount - previousStationAmount) : defaultStationAmount;
        const stationPaymentObject = {
          name: "Total Station Payment",
          type: "REGULAR",
          frequency: "MONTH",
          frequency_interval: 1, // just once
          amount: {
            value: stationFinalAmount, // total amount of stations payment
            currency: currency || "USD",
          },
          cycles: 1, // charge only once
        };
        const current_date = Math.floor(Date.now() / 1000);
        const subscriptionUpdateCharge =
          active && valid_until >= current_date
            ? {
                name: "Subscription Updation Charge!",
                type: "REGULAR",
                frequency: "MONTH",
                frequency_interval: 1, // just once
                amount: {
                  value: amount - previousAmount, // total amount of stations payment
                  currency: currency || "USD",
                },
                cycles: 1, // charge only once
              }
            : {};
        paypal.billingAgreement.update(
          billingAgreementId,
          {
            updatedSubscriptionObj,
            subscriptionUpdateCharge,
            stationPaymentObject
          },
          async (subscriptionError, subscriptionUpdated) => {
            if (!subscriptionError) {
              isUpgradePackage ? await Subscription.findOneAndUpdate({_id}, { productId: product._id })
              : "";
              return
            }
            console.log(
              "Error while updating subscription: ",
              subscriptionError
            );
          }
        );
      }
    )
  );
};

const addOnCharge = async (amount, currency = "USD", billingAgreementId, title) => {
  const addOnObject = {
    name: title || "Total Station Payment",
    type: "REGULAR",
    frequency: "MONTH",
    frequency_interval: 1, // just once
    amount: {
      value: amount, // total amount of stations payment
      currency: currency || "USD",
    },
    cycles: 1, // charge only once
  };
  paypal.billingAgreement.update(billingAgreementId, addOnObject, async (error, subscriptionDetail) => {
    if(error) throw new Error(error);
    return subscriptionDetail
  })
}

const cancelSubscription = async (billingAgreementId, reason) => {  
    paypal.billingAgreement.cancel(billingAgreementId, { reason }, (error, billingDetail) => {
      if(error) throw new Error(error);
      return billingDetail
    })
}



module.exports = {
  updateCompaniesSubscriptions,
  addOnCharge,
  cancelSubscription
}