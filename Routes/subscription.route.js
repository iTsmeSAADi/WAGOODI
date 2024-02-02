const router = require("express").Router();
const auth = require("../Controllers/auth.controllers")
const subscriptionController = require("../Controllers/subscription.controllers")


router.post("/create", auth.verifyUserCookie,subscriptionController.createSubscription)
router.post("/success", subscriptionController.successSubscription)
router.post("/company/all", subscriptionController.getAllCompany)
router.post("/company", auth.verifyUserCookie, subscriptionController.getCompanySubscription)
router.patch("/update", auth.verifyUserCookie, auth.verifyAdminAndCompanyAdmin , subscriptionController.updateSubscription)
router.patch("/enterprise", auth.verifyUserCookie, auth.verifySuperAdmin, subscriptionController.adminEnterpriseSubscriptionUpdate)
router.patch("/station-quantity", auth.verifyUserCookie, auth.verifyAdminAndCompanyAdmin, subscriptionController.stationQuantityUpgrade)
router.patch("/cancelCompanySubscription", auth.verifyUserCookie, auth.verifyAdminAndCompanyAdmin, subscriptionController.cancelCompanySubscription)
router.post("/paypal-dummy", subscriptionController.paypalSubscriptionDummy)

module.exports = router;