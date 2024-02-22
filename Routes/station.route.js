const { verifyUserCookie, verifyAdmin, verifyStationId, verifyNotDriver, verifySuperAdmin, verifyCompanyId } = require("../Controllers/auth.controllers");
const auth = require("../Controllers/auth.controllers");
const station = require("../Controllers/station.controllers")

const router = require("express").Router();

router.post("/", verifyUserCookie, auth.verifyApproved, verifyAdmin, station.createStation)
router.post("/all", verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndStationManager, verifyCompanyId , station.getCompanyStations)
router.post("/sale", verifyUserCookie, auth.verifyApproved, auth.verifyActiveStation, station.createStationSale)
router.patch("/update", verifyUserCookie, auth.verifyApproved, verifyStationId, station.updateStation)
router.get("/:id", verifyUserCookie, station.getStation)
// router.get("/monthly/:id", verifyUserCookie, verifyStationId)
// router.post("/query/:id", verifyUserCookie, verifyStationId)
router.post("/query/", verifyUserCookie, auth.verifyApproved, verifyAdmin, verifyCompanyId, station.queryStation)
router.post("/admin/query", verifyUserCookie, auth.verifyApproved, verifySuperAdmin, station.adminQueryStation)
router.get("/list-all", verifyUserCookie, auth.verifyApproved, verifyAdmin, station.listStations)
router.post("/sales", verifyUserCookie, auth.verifyApproved, verifyNotDriver, station.stationSales) 
router.post("/records", verifyUserCookie, auth.verifyApproved, verifyNotDriver, station.stationRecords)
router.post("/sales-orders", verifyUserCookie, auth.verifyApproved, verifyNotDriver, station.stationSalesOrders)
router.post("/empty-tank", verifyUserCookie, auth.verifyApproved, verifyNotDriver, station.getStationEmptyTankFuel)
router.patch("/fuel/update", verifyUserCookie, auth.verifyApproved, verifyStationId, station.updateStaionFuelDispenser)
router.delete("/", verifyUserCookie, verifyCompanyId, auth.verifyAdminAndStationManager, station.deleteCompanyStation)


module.exports = router;