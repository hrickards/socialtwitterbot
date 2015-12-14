"use strict";
var express     = require("express"),
    mongoose    = require("mongoose"),
    exphbs      = require("express-handlebars"),
    config      = require("./config.js");

var app = module.exports = express();

// models
require("./lib/models/request_token.js");
require("./lib/models/access_token.js");

// HTML output
app.engine("handlebars", exphbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");

// static assets
app.use(express.static("assets"));

// controllers
app.use(require("./lib/controllers/home.js"));
app.use(require("./lib/controllers/twitter.js"));

// error handling
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500);
    res.render("error");
});

// run
var server = app.listen(config.web_port, function () {
    // database server
    mongoose.connect(config.database_url);

    var host = server.address().address;
    var port = server.address().port;

    console.log("Example app listening at http://%s:%s", host, port);
});
