const router = require("express").Router();
const auth = require("../Controllers/auth.controllers")
const order = require("../Controllers/order.controllers")
// const {upload} = require("../index")
const multer = require("multer");
const upload = multer();



router.post("/orders", auth.verifyUserCookie, auth.verifyApproved, auth.verifyNotDriver, order.stationOrders);
router.post("/create", upload.single("attachment"), auth.verifyUserCookie,auth.verifyApproved, order.createOrder);
router.post("/company", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdmin, order.allCompanyQueryOrders)
router.post("/search", auth.verifyUserCookie, auth.verifyApproved, auth.verifyNotDriver, order.queryOrder)
router.patch("/update", auth.verifyUserCookie, auth.verifyApproved, order.updateOrder)
router.get("/:id", auth.verifyUserCookie, auth.verifyApproved, auth.verifyNotDriver, order.getOrder)
router.post("/report", auth.verifyUserCookie, auth.verifyApproved, order.generateAndMailOrdersReport);
router.post("/driver/assign", auth.verifyUserCookie, auth.verifyApproved, auth.verifyDriver, order.driverAssignOrder)
router.post("/driver/reject", auth.verifyUserCookie, auth.verifyApproved, auth.verifyDriver, order.driverRejectOrder)
router.post("/approve", upload.single("attachment"), auth.verifyUserCookie, auth.verifyApproved, auth.verifyStationManager, order.ApproveOrder)
router.post("/driver/cancel", auth.verifyUserCookie, auth.verifyApproved, auth.verifyDriver, order.driverCancelOrder)
router.get("/driver/:driverId", auth.verifyUserCookie, auth.verifyApproved, auth.verifyDriver, order.driverGetOrders)
router.post("/driver/received", upload.single("attachment"), auth.verifyUserCookie, auth.verifyApproved, auth.verifyDriver, order.driverRecievedOrder)
router.post("/driver/delievered", auth.verifyUserCookie, auth.verifyApproved, auth.verifyDriver, order.driverDelieveredOrder);
router.post("/manager/complete", upload.single("attachment"), auth.verifyUserCookie, auth.verifyApproved, auth.verifySeniorStationManager, order.ManagerCompleteOrder);
router.post("/station-manager/complete", upload.single("attachment"), auth.verifyUserCookie, auth.verifyApproved, auth.verifySeniorStationManager, order.stationManagerCompleteOrder);

module.exports = router;