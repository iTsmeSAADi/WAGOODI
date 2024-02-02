const nodemailer = require("nodemailer");
const emailPass = process.env.email_pass;
const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 456,
  auth: {
    user: "hobab.leo99@gmail.com",
    pass: emailPass,
  },
});

const companyEmail = process.env.company_email;

const sendMail = (to, subject, text, other = {}) => {
  var mailOptions = {
    from: companyEmail,
    to,
    subject,
    text,
    ...other
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      throw error;
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

module.exports = {
  sendMail,
};
