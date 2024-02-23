const { sendMail } = require("../Utils/mail");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Account = require("../Models/Account.schema");
const otpGenerator = require("otp-generator");
const OTP = require("../Models/OTP.schema");
const Company = require("../Models/Company.schema");
const { createError, successMessage } = require("../Utils/responseMessage");
const Station = require("../Models/Station.schema");

const privateKey = process.env.PRIVATE_KEY;

const signUpAccount = async (req, res) => {
  let {
    name,
    companyId,
    role,
    stationId,
    email,
    password,
    privilage,
    phone_number,
    address,
  } = req.body;
  // if(!name || !companyId || !role || !stationId || !email || !password || !privilage) return createError(res, 400, "required fields are undefined!")
  const authRole = req.user?.role;
  console.log(req.user);
  try {
    if (role === 0 && authRole !== 0)
      return res.status(401).json({
        success: false,
        error: { msg: "One SuperAdmin exist, unauthorize to create many!" },
      });
    if (authRole !== 0 && authRole !== 1) {
      return res
        .status(401)
        .json({ success: false, error: { msg: "Unauthorize access!" } });
    }
    if (authRole === 1 && !req.user.companyId._id) {
      return res
        .status(200)
        .json({ success: false, error: { msg: "CompanyId is undefined!" } });
    }
    if (authRole === 1) {
      companyId = req.user.companyId._id;
    }
    if (!email || !password || !role || !name) {
      return res
        .status(200)
        .json({
          success: false,
          error: { msg: "Required fields are missing!" },
        });
    }
    if (role === 3 && (!stationId || privilage == "undefined")) {
      return res.status(200).json({
        success: false,
        error: {
          msg: "For station_manager stationId and privilage has to be define!",
        },
      });
    }
    const checkUser = await Account.findOne({ email });
    if (checkUser)
      return res.status(200).json({
        success: false,
        error: { msg: "Account already registered with such email!" },
      });
    const salt = bcrypt.genSaltSync(10);
    const encodePassword = bcrypt.hashSync(password, salt);
    const user = await new Account({
      name,
      companyId,
      role,
      stationId,
      email,
      password: encodePassword,
      privilage,
      phone_number,
      address,
    }).save();
    console.log(user);
    delete user._doc.password;
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error });
  }
};

const signIn = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email) {
    return res
      .status(200)
      .json({ success: false, error: { msg: "email field is undefined!" } });
  }
  if (!password) {
    return res
      .status(200)
      .json({ success: false, error: { msg: "email field is undefined!" } });
  }

  try {
    const user = await Account.findOne({ email })
      .populate("companyId")
      .populate({
        path: "companyId.subscriptionId",
      })
      .populate("stationId").populate({path: "stationId.fuels"});
    if (!user)
      return res
        .status(200)
        .json({ success: false, error: { msg: "No such email registered!" } });
    const passwordMatch = bcrypt.compareSync(password, user.password);
    console.log(passwordMatch);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: { msg: `email or password doesn't match!` },
      });
    }
    delete user.password;
    var token = await jwt.sign({ ...user }, privateKey);
    res.cookie("userToken", token, {
      // maxAge: 60000000,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    console.log("res Cookies : ", res);
    return res.status(200).json({
      success: true,
      data: { data: user, msg: "Successfully logged in!" },
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res
      .status(200)
      .json({ success: false, error: { msg: "email field undefined!" } });
  try {
    const user = await Account.findOne({ email });
    if (!user)
      return res.status(400).json({
        success: false,
        error: { msg: "No user with such email found!" },
      });
    const otp = otpGenerator.generate(4, {
      digits: true,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    await OTP.deleteMany({ accountId: user._id });
    await new OTP({
      accountId: user._id,
      otp,
    }).save();
    res
      .status(200)
      .json({
        success: true,
        data: {
          msg: "Check your email for OTP verification",
          userId: user._id,
        },
      })
      .end();
    await sendMail(email, "OTP Verification", `Your OTP is ${otp}`);
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, error });
  }
};

const verifyOTP = async (req, res) => {
  const { otp, userId } = req.body;
  if (!userId)
    return res
      .status(400)
      .json({ sucess: false, error: { msg: "userId not defined!" } });
  if (!otp)
    return res
      .status(400)
      .json({ success: false, error: { msg: "Undefined otp field!" } });
  if (otp.length !== 4)
    return res
      .status(400)
      .json({ success: false, error: { msg: "otp length should be 4!" } });
  try {
    const otpDoc = await OTP.findOne({ otp });
    console.log("OTP DOC: ", otpDoc);
    const expiresAt = otpDoc.expiresAt * 1000;
    console.log('expiresAt, Date.now()', expiresAt, Date.now())
    if (expiresAt <= Date.now()) {
      return res
        .status(400)
        .json({ success: false, error: { msg: "OTP expired!" } });
    }
    if (otp && otpDoc.otp === otp) {
      return res.status(200).json({
        success: true,
        data: { msg: "OTP verified!", otpId: otpDoc._id },
      });
    }
    return res
      .status(400)
      .json({ success: false, error: { msg: "Invalid OTP entered!" } });
  } catch (error) {
    console.log(error);
    return createError(res, 400, error.message);
  }
};

const updatePassword = async (req, res) => {
  const { otpId, newPassword, userId } = req.body;
  if (!userId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "UserId field is missing!" } });
  if (!newPassword)
    return res.status(200).json({
      success: false,
      error: { msg: "newPassword field is missing!" },
    });
  if (!otpId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "otpId field is missing!" } });

  try {
    const otp = await OTP.findOne({ _id: otpId, accountId: userId });
    if (!otp)
      return res
        .status(200)
        .json({ success: false, error: { msg: "No such active otp found!" } });
    const encodePassword = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
    const user = await Account.findByIdAndUpdate(userId, {
      password: encodePassword,
    });
    await OTP.findByIdAndDelete(otpId);
    res.status(200).json({
      success: true,
      data: { msg: `Successfully Updated ${user.name} Password!` },
    });
  } catch (error) {
    console.log(error);
    res.staus(400).json({ succes: false, error: error.message });
  }
};

const listAllUsers = async (req, res) => {
  const { query = {}, start_date = 0, end_date = Date.now() } = req.body;
  const companyId = req.body.companyId; // Assuming companyId is passed in the request body

  // Check if companyId is present in the request
  if (!companyId) {
    return res.status(400).json({ success: false, error: "Company ID is required!" });
  }

  try {
    const userList = await Account.find({
      ...query,
      companyId: companyId, // Filter accounts by companyId
    });

    res.status(200).json({ success: true, data: userList, message: userList.length > 0 ? "Company Users" : "Company doesn't have any user yet" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};


const getUser = async (req, res) => {
  const { userId } = req.body;
  if (!userId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "userId undefined!" } });
  try {
    const user = await Account.findById(userId);
    if (!user)
      return res.status(200).json({
        success: false,
        error: { msg: "No user with such id found!" },
      });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Account.find({ role: 4 }).select('-password');

    if (drivers.length === 0) {
      return res.status(200).json({
        success: false,
        error: { msg: "No drivers found!" },
      });
    }

    res.status(200).json({ success: true, data: drivers });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.message } });
  }
};



const updateUser = async (req, res) => {
  const { userId, payload = {} } = req.body;
  if (!userId)
    return res
      .status(200)
      .json({ success: false, error: { msg: "userId undefined!" } });
  try {
    const user = await Account.findOneAndUpdate(
      { _id: userId },
      { ...payload },
      { new: true }
    );
    if (!user)
      return res.status(200).json({
        success: false,
        error: { msg: "No user with such id found!" },
      });
    res.status(200).json({
      success: true,
      data: { msg: "Successfully Updated!", data: user },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: { msg: error.msg } });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: { msg: "userId undefined!" } });
  }

  try {
    const user = await Account.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { msg: "No user with such id found!" },
      });
    }

    res.status(200).json({
      success: true,
      data: { msg: "Successfully Deleted!", data: user },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: { msg: error.message } });
  }
};



const changePassword = async (req, res) => {
  const { id, password } = req.body;
  if (!password)
    return res
      .status(200)
      .json({ success: false, error: { msg: "password is undefined!" } });
  const salt = bcrypt.genSaltSync(10);
  const encodePassword = bcrypt.hashSync(password, salt);
  try {
    const user = await Account.findByIdAndUpdate(
      id,
      { password: encodePassword },
      { new: true }
    );
    res.status(200).json({
      success: true,
      data: { data: user, msg: "User Password Succesfully Updated!" },
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ sucess: false, error: { msg: error.msg || error } });
  }
};

const signOut = async (req, res) => {
  try {
    res.clearCookie();
    res.status(202).json({ data: { msg: "Successfully Logout!" } });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

const verifySuperAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role !== 0)
      return res.status(403).json({
        success: false,
        error: { msg: "Unauthorized to access this route!" },
      });
    req.user = user;
    next();
  } catch (error) {
    res.status(400).json({});
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role == 0 || user.role == 1 || user.role == 2) {
      req.user = user;
      next();
      return;
    } else {
      return res.status(403).json({
        success: false,
        error: { msg: "Unauthorized to access this route!" },
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const verifyAdminAndCompanyAdmin = async (req, res, next) => {
  const companyId = req?.body?.companyId || req?.params?.companyId;
  console.log(req.body);
  console.log(req.user.companyId._id);
  const role = req?.user?.role;
  if (role == 0 || role == 1) {
    if (role == 1 && companyId != req.user.companyId._id) {
      return res.status(401).json({
        success: false,
        error: { msg: "Unauthorized!, Only owner of company can access!" },
      });
    }
    next();
    return;
  } else {
    return res.status(401).json({
      success: false,
      error: { msg: "Unauthorized to access this route!" },
    });
  }
};

const verifyNotDriver = async (req, res, next) => {
  if (req.user?.role === 4)
    return res
      .status(401)
      .json({ success: false, error: { msg: "Unauthorized!" } });
  next();
};

const verifyOrderManager = async (req, res, next) => {
  if (req.user?.role !== 2)
    return res
      .status(401)
      .json({ success: false, error: { msg: "Unauthorized!" } });
  next();
};

const verifyUserCookie = async (req, res, next) => {
  let token = req.cookies["userToken"]
    ? req.cookies["userToken"]
    : req.headers["usertoken"]
    ? req.headers["usertoken"]
    : null;
  console.log(req.headers);
  console.log("TOKEN : ", token);
  if (!token)
    return res
      .status(401)
      .json({
        success: false,
        error: { msg: "Not Logged In!", isLogIn: false },
      });
  try {
    const user = jwt.verify(token, privateKey);
    if (user) {
      req.user = user._doc;
      next();
      return;
    } else {
      return res
        .status(403)
        .json({ success: false, error: { msg: "Invalid token!" } });
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({});
  }
};

const verifyIsLoggedIn = async (req, res) => {
  successMessage(res, null, "User is logged in!");
};

const verifyUser = async (req, res, next) => {
  const id = req.user._id;
  if (!req.body.id)
    return res
      .status(200)
      .json({ success: false, error: { msg: "id is undefined!" } });
  if (id != req.body.id)
    return res
      .status(401)
      .json({ success: false, error: { msg: "Unauthorized to access!" } });
  next();
};

const verifyCompanyId = async (req, res, next) => {
  console.log("body companyId ", req.body.companyId);
  console.log("query companyId ", req.query.companyId);
  console.log("user companyId ", req.user.companyId._id);
  const companyId = req.query?.companyId || req.body.companyId;
  console.log("companyid equals ?  ", req?.user?.companyId?._id == companyId);
  const authorizedCompanyUser = req?.user?.companyId?._id == companyId;
  if (!authorizedCompanyUser && req.user.role != 0)
    return res.status(401).json({
      success: false,
      error: { msg: "Unauthorized! Company id's doesnot match." },
    });
  next();
};

const verifyStationId = async (req, res, next) => {
  console.log("stationId", req.user.stationId)
  try {
    const authorizedStationManager =
      req?.user?.stationId._id &&
      req?.user?.stationId._id === req.body.stationId;
    if (req?.user?.role == 1 || req?.user?.role == 2) {
      const station = await Station.findOne({
        companyId: req?.user?.companyId?._id,
        _id: req.body.stationId,
      });
      if (!station)
        return createError(
          res,
          400,
          "This station does not belong to your company!"
        );
      return next();
    }
    if (!authorizedStationManager && req?.user?.role != 1)
      return res.status(200).json({
        success: false,
        error: { msg: "Unauthorized! Station id's doesnot match." },
      });
    next();
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const verifyStationManager = async (req, res, next) => {
  const { role } = req.user;
  if (role !== 3)
    return res
      .status(200)
      .json({ success: false, error: { msg: "Not Station Manager" } });
  next();
};

const verifySeniorStationManager = async (req, res, next) => {
  const { privilage } = req.user;
  if (privilage !== 0)
    return res.status(200).json({
      success: false,
      error: { msg: "Do not have Senior Manager privilage!" },
    });
  next();
};

const verifyDriver = async (req, res, next) => {
  const { role } = req.user;
  console.log(role);
  if (role != 4)
    return res
      .status(401)
      .json({ success: false, error: { msg: "Not a Driver!" } });
  next();
};

const verifyApproved = async (req, res, next) => {
  const { companyId: {_id: companyId}, role } = req.user;
  if (role == 0) {
    next();
    return;
  }
  try {
    const company = await Company.findById(companyId);
    if (!company)
      return res
        .status(400)
        .json({ success: false, error: { msg: "Company is not registered!" } });
    if (!company.approved) {
      return res
        .status(401)
        .json({ success: false, error: { msg: "Company is not approved!" } });
    }
    next();
    return;
  } catch (error) {
    console.log(error);
    return createError(res, 400, error.message);
  }
};

// const verifyDriverOrder = async (req, res, next) => {
//   const {_id: driverId} = req.user;

// };

const accessTokenExpired = async (req, res) => {
  const { exp } = req.user;
  if (!exp) return successMessage(res, null, "token does not exist!");
  if (exp >= Date.now())
    return successMessage(res, { expired: true }, "token is expired!");
  successMessage(
    res,
    { expired: false, expiryTime: exp },
    "token is not expired"
  );
};

const verifyActiveStation = async (req, res, next) => {
  const user = req.user;
  if (user.role == 0) {
    next();
  }
  const stationId =
    req.params.stationId || req.body.stationId || req.user.stationId._id;
  if (!stationId) return createError(res, 400, "stationId is undefined!");
  try {
    const station = await Station.findById(stationId);
    if (!station.active) return createError(res, 400, "station is not active");
    next();
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const verifyAdminAndStationManager = async (req, res, next) => {
  const role = req.user.role;
  if (role == 0 || role == 1 || role == 3) {
    next();
  } else {
    return createError(
      res,
      401,
      "Unauthorized! You should be superAdmin, Admin or StationManager"
    );
  }
};

module.exports = {
  signIn,
  signUpAccount,
  forgetPassword,
  verifyOTP,
  verifyAdmin,
  verifySuperAdmin,
  verifyUserCookie,
  updatePassword,
  changePassword,
  verifyCompanyId,
  verifyStationId,
  verifyNotDriver,
  verifyAdminAndCompanyAdmin,
  verifyStationManager,
  verifySeniorStationManager,
  verifyOrderManager,
  verifyDriver,
  listAllUsers,
  getUser,
  updateUser,
  signOut,
  verifyUser,
  verifyApproved,
  accessTokenExpired,
  verifyActiveStation,
  verifyAdminAndStationManager,
  verifyIsLoggedIn,
  getAllDrivers,
  deleteUser
};
