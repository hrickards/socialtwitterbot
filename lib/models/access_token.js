var mongoose = require("mongoose");

mongoose.model("AccessToken", {
    token:  { type: String, required: true },
    secret: { type: String, required: true },
    user:   { type: String, required: true }, // user id
    name:   { type: String } // screen name or other identifier
});
