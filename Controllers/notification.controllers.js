const Notification = require("../Models/Notification.schema");
const { successMessage } = require("../Utils/responseMessage");

const getCompanyNotifications = async (req, res) => {
  const { companyId } = req.body;
  if (!companyId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "companyId is undefined!" } });
  try {
    const notification = await companyNotifications(companyId);
    successMessage(res, { notification });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const getStationManagerNotifications = async (req, res) => {
  const {
    stationId,
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!stationId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "stationId is undefined!" } });
  try {
    const notifications = await getAllNotification(
      { stationId },
      start_date,
      end_date
    );
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const getOrderManagerNotifications = async (req, res) => {
  const {
    accountId,
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if (!accountId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "orderManagerAccountId is undefined!" } });
  try {
    const notifications = await getAllNotification(
      { accountId },
      start_date,
      end_date
    );
        // Process each notification in the array
        const processedNotifications = notifications.map(notification => {
          // Extract the information you need from each notification
          const notificationId = notification.id && notification.id ? notification.id : "N/A";
          const orderNumber = notification.orderId.from && notification.orderId.orderNumber ? notification.orderId.orderNumber : "N/A";
          const orderFrom = notification.orderId.from.address && notification.orderId.from.address ? notification.orderId.from.address : "N/A";
          const stationName = notification.stationId && notification.stationId.name ? notification.stationId.name : "N/A";
          const stationAddress = notification.stationId && notification.stationId.address ? notification.stationId.address : "N/A";
          const company = notification.companyId && notification.companyId.name ? notification.companyId.name : "N/A";
          const orderDescription = notification.description && notification.description ? notification.description : "N/A";
          const tipAmount = notification.orderId.fuel_value || 0; // Assuming a default value if undefined
          const createdAt = notification.orderId.createdAt ? notification.orderId.createdAt : "N/A";
    
          // Return the processed information for each notification
          return {
            notificationId,
            orderNumber,
            orderFrom,
            stationName,
            stationAddress,
            company,
            orderDescription,
            tipAmount,
            createdAt,
          };
        });
    
        // Send the response outside the loop
        res.status(200).json({ success: true, data: processedNotifications });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const getDriverNotifications = async (req, res) => {
  const {
    query,
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  const { accountId } = query;
  if (!accountId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "accountId undefined!" } });
  query.type = 2;
  try {
    let notifications = await getAllNotification(query, start_date, end_date);
    
    // Process each notification in the array
    const processedNotifications = notifications.map(notification => {
      // Extract the information you need from each notification
      const notificationId = notification.id && notification.id ? notification.id : "N/A";
      const orderNumber = notification.orderId.from && notification.orderId.orderNumber ? notification.orderId.orderNumber : "N/A";
      const orderFrom = notification.orderId.from.address && notification.orderId.from.address ? notification.orderId.from.address : "N/A";
      const stationName = notification.stationId && notification.stationId.name ? notification.stationId.name : "N/A";
      const stationAddress = notification.stationId && notification.stationId.address ? notification.stationId.address : "N/A";
      const company = notification.companyId && notification.companyId.name ? notification.companyId.name : "N/A";
      const orderDescription = notification.description && notification.description ? notification.description : "N/A";
      const tipAmount = notification.orderId.fuel_value || 0; // Assuming a default value if undefined
      const createdAt = notification.orderId.createdAt ? notification.orderId.createdAt : "N/A";

      // Return the processed information for each notification
      return {
        notificationId,
        orderNumber,
        orderFrom,
        stationName,
        stationAddress,
        company,
        orderDescription,
        tipAmount,
        createdAt,
      };
    });

    // Send the response outside the loop
    res.status(200).json({ success: true, data: processedNotifications });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const allNotifications = async (req, res) => {
  const {
    query = {},
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
  } = req.body;
  if(req.user.role == 0){
    query.type = 0
  } else {
    query.type = 1;
  }
  try {
    getAllNotification(query, start_date, end_date).then((notifications) =>
      res.status(200).json({ success: true, data: notifications })
    );
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const updateOneNotification = async (req, res) => {
  const { id, payload } = req.body;
  delete payload.companyId;
  delete payload._id;
  if (!id)
    return res
      .status(200)
      .json({ succcess: false, error: { msg: "id is undefined!" } });
  if (!payload)
    return res
      .status(200)
      .json({ succcess: false, error: { msg: "payload is undefined!" } });
  try {
    updateNotification(id, payload).then((notification) =>
      res.status(200).json({ success: true, data: notification })
    );
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

// notification methods.
const createNotification = async ({
  orderId,
  companyId,
  type,
  description,
  accountId = null,
}) => {
  if (!orderId || !companyId || !type || !description) {
    throw new Error("Required fields undefined!");
  }
  try {
    const notification = await new Notification({
      orderId,
      companyId,
      type,
      description,
      accountId,
    }).save();
    return notification;
  } catch (error) {
    throw error;
  }
};

const updateNotification = async (id, payload = {}) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id },
      { ...payload },
      { new: true }
    );
    return notification;
  } catch (error) {
    throw error;
  }
};

const getAllNotification = async (query, start_date, end_date) => {
  try {
    console.log(query)
    const notifications = await Notification.find({
      ...query,
      createdAt: { $gte: start_date, $lte: end_date },
    })
      .populate("companyId")
      .populate("stationId")
      .populate("accountId")
      .populate("orderId")
      .populate("subscriptionId")
      .sort({"createdAt": -1});
    return notifications;
  } catch (error) {
    throw error;
  }
};

const getNotification = async (id) => {
  try {
    const notification = await Notification.findById(id);
    return notification;
  } catch (error) {
    throw error;
  }
};

const orderNotifications = async (orderId) => {
  try {
    const notifications = await Notification.find({ orderId }).sort(
      "createdAt"
    );
    return notifications;
  } catch (error) {
    throw error;
  }
};

const companyNotifications = async (companyId) => {
  try {
    const notifications = await Notification.find({ companyId }).sort(
      "createdAt"
    );
    return notifications;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNotification,
  updateOneNotification,
  allNotifications,
  getCompanyNotifications,
  getDriverNotifications,
  getStationManagerNotifications,
  getOrderManagerNotifications
};
