const company = require("../Controllers/company.controllers")
const auth = require("../Controllers/auth.controllers")
const router= require("express").Router()
const multer = require("multer");
const upload = multer();


router.get("/:companyId", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndCompanyAdmin, company.getCompany);
router.post("/all", auth.verifyUserCookie, auth.verifyAdmin, company.getAllCompany);
router.post("/info-all", auth.verifyUserCookie, auth.verifyAdmin, company.companiesInfo)
router.post("/empty-tank", auth.verifyUserCookie, auth.verifyApproved, auth.verifyAdminAndCompanyAdmin, company.companyEmptyFuelRecords)
router.patch("/update", upload.single("image"), auth.verifyUserCookie, auth.verifyApproved , auth.verifyAdminAndCompanyAdmin, company.updateCompany);
router.patch("/company-approved", auth.verifyUserCookie, auth.verifySuperAdmin, company.companyApproved)
router.patch("/company-reject", auth.verifyUserCookie, auth.verifySuperAdmin, company.companyRejected)
router.post("/send-report",  upload.single("attachment"), auth.verifyUserCookie, auth.verifyAdminAndCompanyAdmin, company.sendReportMail)

module.exports = router;