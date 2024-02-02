const mongoose = require("mongoose");
const MONGO_URI = process.env.MONGO_URI;

let dbSession;
const connectDB = async () => {
    try {
      await mongoose.connect(MONGO_URI);
      console.log("DB connected!");
      dbSession = await mongoose.startSession()
      global.dbSession = dbSession;
    } catch (error) {
      if (error) return console.log("DB ERROR : ", error);
    }
  };
  
  module.exports = connectDB;