const mongoose = require("mongoose")

const AttachmentSchema = new mongoose.Schema({
    name: {type: String, required: true},
    file_url: {type: String, required: true},
})

const Attachment = mongoose.model("attachment", AttachmentSchema)

module.exports = Attachment;