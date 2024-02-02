// Import the functions you need from the SDKs you need
const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} = require("firebase/storage");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPv6GWFB4dO5td7h7pBD8jtZWl82i8BuY",
  authDomain: "wagoodi-app.firebaseapp.com",
  projectId: "wagoodi-app",
  storageBucket: "wagoodi-app.appspot.com",
  messagingSenderId: "232562434218",
  appId: "1:232562434218:web:53a6a5d4f319ed1f2cb0d3",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Create a root reference
const storage = getStorage();

// Create a reference to 'mountains.jpg'
// While the file names are the same, the references point to different files

const uploadFile = async (fileName, file) => {
  const pdfReportRef = ref(storage, `/reports/${fileName}.pdf`);
  try {
    // await uploadBytes(pdfReportRef, file);
    const url = await firestoreUploadFile(pdfReportRef, file);
    return url;
  } catch (error) {
    console.log(error);
    return error;
  }
  // return uploadBytes(pdfReportRef, file).then( async (snapshot) => {
  //     const url = await getDownloadURL(pdfReportRef)
  //     return url;
  //   }).catch(error => {
  //     console.log(error)
  //     return error
  // });
};

const uploadOrderAttachment = async (companyId, fileName, file, mimetype) => {
  if(!file) throw new Error("file is undefined!")
  const orderAttachments = ref(storage, `/orderAttachments/${companyId}/${fileName}.${mimetype}`);
  try {
    // await uploadBytes(pdfReportRef, file);
    const url = await firestoreUploadFile(orderAttachments, file);
    console.log("attachemnt URL : ", url)
    return url;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const firestoreUploadFile = async (storageRef, file) => {
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);
  return fileUrl;
};

const uploadCompanyFile = async (fileName, file) => {
  const companyRef = ref(storage, `/company/${fileName}.${file.mimetype}`);
  try {
    const url = await firestoreUploadFile(companyRef, file);
    return url;
  } catch (error) {
    console.log(error);
    return error;
  }
};

const uploadUserFile = async (fileName, file) => {
  const userRef = ref(storage, `/user/${fileName}.${file.mimetype}`);
  try {
    const url = await firestoreUploadFile(userRef, file);
    return url;
  } catch (error) {
    console.log(error);
    return error;
  }
};

module.exports = {
  uploadFile,
  uploadCompanyFile,
  uploadUserFile,
  uploadOrderAttachment,
};
