"use strict";
var express = require("express");

var app = module.exports = express();

// static homepage
app.get("/", function (req, res) {
    res.render("home");
});
