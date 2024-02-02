const router = require("express").Router()
const auth = require("../Controllers/auth.controllers")
const productController = require("../Controllers/product.controller")

router.get("/", auth.verifyUserCookie, productController.getAllProduct)
router.get("/:productId", auth.verifyUserCookie, productController.getProduct)
router.post("/", auth.verifyUserCookie, auth.verifySuperAdmin, productController.createProduct)
router.patch("/", auth.verifyUserCookie, auth.verifySuperAdmin, productController.updateProduct)
router.delete("/", auth.verifyUserCookie, auth.verifySuperAdmin, productController.deleteProduct)

module.exports = router;