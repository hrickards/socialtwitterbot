var mongoose = require("mongoose");

mongoose.model("RequestToken", {
    token:  { type: String, required: true },
    secret: { type: String, required: true }
});
