var mongoose = require("mongoose");

var feedbackSchema = new mongoose.Schema({
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String,
        country: String
    },
    message: String,
    messageDate: {
        type: String,
        default: Date.now.toString(),
    },
    comments : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }
    ]
});

module.exports = mongoose.model("Feedback", feedbackSchema);