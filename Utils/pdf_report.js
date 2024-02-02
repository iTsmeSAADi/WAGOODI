var pdf = require("pdf-creator-node");
var fs = require("fs");
const XLSX = require("xlsx");
var html = fs.readFileSync("./report.html", "utf8");

const createPdf = async (document, options) => {
  pdf
    .create(document, options)
    .then((res) => {
      console.log(res);
    })
    .catch((error) => {
      console.error(error);
    });
};

const pdfSetup = async (title, data) => {
  var options = {
    format: "A3",
    orientation: "portrait",
    border: "10mm",
    header: {
      height: "45mm",
      contents: '<div style="text-align: center;">Wagoodi Report</div>',
    },
    footer: {
      height: "28mm",
      contents: {
        first: "Cover page",
        2: "Second page", // Any page number is working. 1-based index
        default: `<span style="color: #444;">{{page}}</span>/<span>{{page}}</span>`, // fallback value
        last: "Last Page",
      },
    },
  };
  const path = "./output.pdf";
  var document = {
    html: html,
    data: {
      data: data,
      title: title,
    },
    path: path,
    type: "",
  };
  try {
    await createPdf(document, options);
    return path;
  } catch (error) {
    return error;
  }
};

const generateExcelSheet = async (data) => {
    try{
        console.log(data)
    const workSheet = XLSX.utils.json_to_sheet(data);
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Sheet 1");
    const filePath = "./output.xlsx"
    await XLSX.writeFile(workBook, filePath);
    return filePath
  } catch (error) {
    console.log(error);
    return error;
  }
};



module.exports = { pdfSetup, generateExcelSheet };
