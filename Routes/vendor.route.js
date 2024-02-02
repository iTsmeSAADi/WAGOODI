const router = require("express").Router();
const auth = require("../Controllers/auth.controllers")
const vendor = require("../Controllers/vendor.controllers")

router.post("/company", auth.verifyUserCookie, auth.verifyApproved, auth.verifyCompanyId, auth.verifyAdmin, vendor.getCompanyVendors ) // query object include
router.post("/all", auth.verifyUserCookie, auth.verifySuperAdmin, vendor.getAllVendors) // query object include
router.post("/create", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndCompanyAdmin, vendor.createVendor)
router.patch("/update", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdmin, vendor.updateVendor)
router.delete("/:id", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdmin, vendor.deleteVendor)

module.exports = router;