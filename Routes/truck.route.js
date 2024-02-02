const router = require("express").Router()
const auth = require("../Controllers/auth.controllers")
const truck = require("../Controllers/truck.controllers")

router.get("/:driverId", auth.verifyUserCookie, truck.getDriverTrucks)
router.post("/", auth.verifyUserCookie, truck.createTruck)
router.patch("/", auth.verifyUserCookie, truck.updateTruck)
router.delete("/", auth.verifyUserCookie, truck.deleteTruck)


module.exports = router;