const router = require("express").Router();
const auth = require("../Controllers/auth.controllers")
const statistics = require("../Controllers/statistic.controllers")
const multer = require("multer");
const upload = multer();

router.post("/company", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndCompanyAdmin, statistics.companyAllStats )
router.post("/station", auth.verifyUserCookie, statistics.stationStats)
router.post("/company-drivers", auth.verifyUserCookie, auth.verifyApproved,  auth.verifyAdminAndCompanyAdmin, statistics.driversStats)
router.post("/sales-manager", auth.verifyUserCookie, auth.verifyApproved,  auth.verifyAdminAndCompanyAdmin, statistics.getSalesManagerStats)
router.post("/driver", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndCompanyAdmin, statistics.individualDriverStats)
router.post("/send-report", upload.single("report"), auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndCompanyAdmin, statistics.sendStatsReport)


module.exports = router;