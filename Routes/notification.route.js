const router = require("express").Router();
const auth = require("../Controllers/auth.controllers")
const notification = require("../Controllers/notification.controllers")

router.post("/company", auth.verifyUserCookie, auth.verifyAdmin, notification.getCompanyNotifications) // companyAdmin and orderManager
router.post("/admin", auth.verifyUserCookie, auth.verifySuperAdmin, notification.allNotifications ) // can query..
router.post("/driver", notification.getDriverNotifications)
router.post("/station-manager", auth.verifyUserCookie, auth.verifyNotDriver, notification.getStationManagerNotifications) // can specify date.
router.post("/order-manager", auth.verifyUserCookie, auth.verifyOrderManager, notification.getOrderManagerNotifications) // can specify date.



module.exports = router;