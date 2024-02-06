const Account = require("../Models/Account.schema");
const Company = require("../Models/Company.schema");
const bcrypt = require("bcrypt");
const { uploadCompanyFile } = require("../Utils/firebase");
const { createError, successMessage } = require("../Utils/responseMessage");
const EmptyTankModel = require("../Models/EmptyTank.schema");
const { sendMail } = require("../Utils/mail");

const signUpCompany = async (req, res) => {
  const { name, address, phone, email, crn_number, tax_number, password } =
    req.body;
  if (
    !name ||
    !address ||
    !phone ||
    !email ||
    !crn_number ||
    !tax_number ||
    !password
  )
    return res.status(200).json({
      success: false,
      error: { msg: "Required fields are undefined!" },
    });
  try {
    const check = await Company.findOne({ email });
    if (check)
      return res.status(200).json({
        success: false,
        error: { msg: "account for company with such email already exist!" },
      });
    const company = await new Company({
      name,
      address,
      phone,
      email,
      crn_number,
      tax_number,
    }).save();
    const companyId = company._id;
    const salt = bcrypt.genSaltSync(10);
    const encodePassword = bcrypt.hashSync(password, salt);
    const user = await new Account({
      companyId,
      role: 1,
      email,
      password: encodePassword,
      name: `${name} Admin`,
      phone_number: phone,
    }).save();
    delete user.password;
    res.status(200).json({
      success: true,
      data: { msg: "Company account registered successfully!", data: user },
    });
  } catch (error) {
    console.log(error);
    res.status(200).json({ success: false, error });
  }
};

const updateCompany = async (req, res) => {
  const { companyId, payload } = req.body;

  // Parsing payload if it's a stringified JSON
  let parsedPayload;
  try {
    parsedPayload = JSON.parse(payload);
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, error: { msg: "Invalid JSON in payload", data: parsedPayload } });
  }

  res.status(200).json({ data: parsedPayload });
};



const getCompany = async (req, res) => {
  const { companyId } = req.params;
  if (!companyId)
    return res.status(200).json({
      success: false,
      error: { msg: "companyId parameter is undefined!" },
    });
  try {
    const company = await Company.findById(companyId);
    if (!company)
      return res.status(200).json({
        success: false,
        error: { msg: "No company with such id found!" },
      });
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { msg: error.msg || error } });
  }
};

const getAllCompany = async (req, res) => {
  const {
    query = {},
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
    sort = "createdAt",
  } = req.body;
  const isEnterprise = query.enterprise;
  delete query?.enterprise;
  try {
    const companies = await Company.find({})
      .populate({
        path: "subscriptionId",
        match: {
          subscriptionType: isEnterprise ? 1 : { $exists: true },
        },
      }).populate({path: "subscriptionId.productId"})
      .sort({ "subscriptionId.active": -1 });
    res.status(200).json({ success: true, data: companies });
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .json({ success: false, error: { msg: error.msg || error } });
  }
};

const companiesInfo = async (req, res) => {
  const { start_date = 0, end_date = Math.floor(Date.now() / 1000) } = req.body;
  try {
    // aggregation be used for now :
    // company should be matched and for every company grouping be done base on station id sale should be calculated for that period
    // station sale total should be compared and station with highest sale should be save in a field
    // grouping be done based on the company and the for every company : company name along with sum of total from stations group and the highest earning station be saved.
    const companiesData = await Company.aggregate(
      [
        {
          $lookup:
            /**
             * query: The query in MQL.
             */
            {
              from: "stations",
              localField: "_id",
              foreignField: "companyId",
              as: "stationss",
            },
        },
        {
          $unwind:
            /**
             * path: Path to the array field.
             * includeArrayIndex: Optional name for index.
             * preserveNullAndEmptyArrays: Optional
             *   toggle to unwind null and empty values.
             */
            {
              path: "$stationss",
            },
        },
        {
          $group:
            /**
             * _id: The id of the group.
             * fieldN: The first field name.
             */
            {
              _id: "$_id",
              stationsCount: {
                $sum: 1,
              },
              stationss: {
                $push: "$$ROOT.stationss",
              },
              company: {
                $first: "$$ROOT",
              },
              company_name: {
                $first: "$$ROOT.name",
              },
              company_approved: {
                $first: "$$ROOT.approved",
              },
            },
        },
        {
          $unwind:
            /**
             * path: Path to the array field.
             * includeArrayIndex: Optional name for index.
             * preserveNullAndEmptyArrays: Optional
             *   toggle to unwind null and empty values.
             */
            {
              path: "$stationss",
              preserveNullAndEmptyArrays: true,
            },
        },
        {
          $lookup:
            /**
             * from: The target collection.
             * localField: The local join field.
             * foreignField: The target join field.
             * as: The name for the results.
             * pipeline: Optional pipeline to run on the foreign collection.
             * let: Optional variables to use in the pipeline field stages.
             */
            {
              from: "orders",
              localField: "stationss._id",
              foreignField: "stations.id",
              pipeline: [
                {
                  $match: {
                    status: 4,
                  },
                },
              ],
              as: "orders",
            },
        },
        {
          $addFields:
            /**
             * newField: The new field name.
             * expression: The new field expression.
             */
            {
              completedOrders: {
                $size: "$orders",
              },
            },
        },
        {
          $lookup:
            /**
             * from: The target collection.
             * localField: The local join field.
             * foreignField: The target join field.
             * as: The name for the results.
             * pipeline: Optional pipeline to run on the foreign collection.
             * let: Optional variables to use in the pipeline field stages.
             */
            {
              from: "sales",
              localField: "stationss._id",
              foreignField: "stationId",
              as: "station_sales",
            },
        },
        {
          $addFields:
            /**
             * newField: The new field name.
             * expression: The new field expression.
             */
            {
              // stationWithEarning:
              // {
              stationEarning: {
                $sum: "$station_sales.amount",
              },
              //   station: "$stationss"
              // }
            },
        },
        {
          $group:
            /**
             * _id: The id of the group.
             * fieldN: The first field name.
             */
            {
              _id: "$_id",
              numOfStations: {
                $first: "$stationsCount",
              },
              company: {
                $first: "$company",
              },
              company_name: {
                $first: "$company_name",
              },
              company_approved: {
                $first: "$company_approved",
              },
              completedOrders: {
                $sum: "$completedOrders",
              },
              earnings: {
                $sum: "$stationEarning",
              },
              stationMaxEarning: {
                $max: "$stationEarning",
              },
              stationWithEarning: {
                $push: {
                  station: "$stationss",
                  earning: "$stationEarning",
                },
              },
              station_with_max_earning: {
                $first: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$stationWithEarning",
                        cond: {
                          $eq: [
                            {
                              $max: "$stationMaxEarning",
                            },
                            "$$this.earning",
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            },
        },
        {
          $group:
            /**
             * _id: The id of the group.
             * fieldN: The first field name.
             */
            {
              _id: "$_id",
              station_with_max_earning: {
                $first: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$stationWithEarning",
                        cond: {
                          $eq: [
                            {
                              $max: "$stationMaxEarning",
                            },
                            "$$this.earning",
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
              numOfStations: {
                $first: "$numOfStations",
              },
              earnings: {
                $first: "$earnings",
              },
              completedOrders: {
                $first: "$completedOrders",
              },
              company: {
                $first: "$company",
              },
              company_name: {
                $first: "$company_name",
              },
              company_approved: {
                $first: "$company_approved",
              },
            },
        },
      ]
    ).exec();
    // first we have to unwind stations then using those station we will unwind daysales and dayorders
    // we will then
    successMessage(res, companiesData, null);
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const companyApproved = async (req, res) => {
  const { companyId } = req.body;
  try {
    const company = await Company.findOneAndUpdate(
      { _id: companyId },
      { approved: true }
    );
    if (!company)
      return res
        .status(400)
        .json({ success: false, error: { msg: "company not found!" } });
    return res.status(200).json({
      success: true,
      data: { payload: company, msg: "Successfully update!" },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(400)
      .json({ success: false, error: { msg: error.message || error } });
  }
};

const companyRejected = async (req, res) => {
  const { companyId } = req.body;
  try {
    const company = await Company.findByIdAndRemove(companyId);
    return res.status(200).json({
      success: true,
      data: {
        payload: company,
        msg: "Company successfully rejected and deleted!",
      },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(400)
      .json({ success: false, error: { msg: error.message || error } });
  }
};

const companyEmptyFuelRecords = async (req, res) => {
  const {
    companyId,
    start_date = 0,
    end_date = Math.floor(Date.now() / 1000),
    query = {},
  } = req.body;
  if (!companyId) return createError(res, 400, "companyId is undefined!");
  try {
    const companyEmptyTankFuels = await EmptyTankModel.find({
      companyId,
      ...query,
      createdAt: { $gte: start_date, $lte: end_date },
    });
    successMessage(res, companyEmptyTankFuels, null);
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

const sendReportMail = async (req, res) => {
  const { email, companyId } = req.body;
  console.log("req file : ", req.file);
  const file = req?.file?.buffer;
  if (!email) return createError(res, 400, "email is undefined!");
  if (!file) return createError(res, 400, "file is undefined!");
  try {
    const fileUrl = await uploadCompanyFile(`${companyId}`, file);
    successMessage(res, null, "Report send! Check your email inbox.");
    sendMail(email, "Wagoodi, Company Report", `Attachment URL : ${fileUrl}`);
  } catch (error) {
    console.log(error);
    createError(res, 400, error.message);
  }
};

module.exports = {
  signUpCompany,
  getCompany,
  updateCompany,
  getAllCompany,
  companyRejected,
  companyApproved,
  companiesInfo,
  companyEmptyFuelRecords,
  sendReportMail,
};
