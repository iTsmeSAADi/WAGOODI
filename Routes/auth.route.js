const router = require("express").Router();
const auth = require("../Controllers/auth.controllers")
const {signUpCompany} = require("../Controllers/company.controllers")

router.post("/sign-up",  auth.signUpAccount)
// company sign-up / register
router.get("/is-log-in", auth.verifyUserCookie, auth.verifyIsLoggedIn)
router.post("/company/sign-up", signUpCompany)
router.post("/sign-in", auth.signIn)
router.post("/forget-password", auth.forgetPassword)
router.post("/verify-otp", auth.verifyOTP)
router.patch("/update-password", auth.updatePassword)
router.patch("/change-password", auth.verifyUserCookie, auth.verifyUser, auth.changePassword)
router.patch("/update/", auth.verifyUserCookie, auth.verifyAdmin, auth.updateUser)
router.delete("/user/:id", auth.verifyUserCookie, auth.deleteUser)
router.post("/list/", auth.verifyUserCookie, auth.verifyAdminAndCompanyAdmin, auth.listAllUsers)
router.post("/", auth.verifyUserCookie, auth.verifySuperAdmin, auth.getUser)
router.post("/getAllDrivers", auth.verifyUserCookie, auth.verifyCompanyId, auth.getAllDrivers)
router.get("/check-token", auth.verifyUserCookie, auth.accessTokenExpired)


module.exports = router;