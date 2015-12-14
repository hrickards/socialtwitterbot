"use strict";
var express     = require("express"),
    mongoose    = require("mongoose"),
    OAuth       = require("oauth"),
    querystring = require("querystring"),
    util        = require("util"),
    async       = require("async"),
    config      = require("../../config.js");

var twitter = module.exports = express();

var RequestToken = mongoose.model("RequestToken"),
    AccessToken  = mongoose.model("AccessToken");

// generate API URLs from endpoint name
var endpoint = function (slug) {
    return "https://api.twitter.com/" + slug;
};

// setup oauth handler
var oauth = new OAuth.OAuth(
        endpoint("oauth/request_token"),
        endpoint("oauth/access_token"),
        config.twitter_key,
        config.twitter_secret, 
        "1.0",
        config.callback_base + "/callback",
        "HMAC-SHA1"
);
var redirect_endpoint = endpoint("oauth/authorize");

// start twitter authentication
twitter.get("/authenticate", function (req, res, next) {
    // obtain twitter oauth request token
    oauth.getOAuthRequestToken(function (err, requestToken, requestSecret) {
        if (err) return next(err);

        // store token
        RequestToken.create({
            token: requestToken,
            secret: requestSecret
        });

        // redirect user to twitter auth page, that'll redirect
        // back to our callback page
        var redirect_url = util.format("%s?%s", redirect_endpoint, querystring.stringify({
            "oauth_token": requestToken
        }));
        res.redirect(302, redirect_url);
    });
});

// finish user authentication (twitter auth page redirects
// the user here)
twitter.get("/callback", function (req, res, next) {
    // find request token
    var requestTokenKey = req.query.oauth_token;
    if (typeof requestTokenKey === "undefined" || requestTokenKey === null || requestTokenKey.length === 0)
        return next(new Error("No oauth_token header"));

    // find token verifier
    var verifier = req.query.oauth_verifier;
    if (typeof verifier === "undefined" || verifier === null || verifier.length === 0)
        return next(new Error("No oauth_verifier header"));

    // find request token secret
    var findRequestToken = function (callback) {
        RequestToken.findOne({token: requestTokenKey}, function (err, token) {
            if (err) return callback(err);
            if (typeof token === "undefined" || token === null)
                return callback(new Error("No matching request token"));

            return callback(null, token);
        });
    };

    // convert request token into access token
    var getAccessToken = function (requestToken, callback) {
        // convert request token into access token
        oauth.getOAuthAccessToken(requestToken["token"], requestToken["secret"], verifier, function (err, accessToken, accessSecret) {
            if (err) return callback(err);

            return callback(null, requestToken, accessToken, accessSecret);
        });
    };

    // find user ID for access token
    var getUserData = function (requestToken, accessToken, accessSecret, callback) {
        oauth.get("https://api.twitter.com/1.1/account/verify_credentials.json", accessToken, accessSecret, function (err, data) {
            if (err) return callback(err);

            return callback(null, requestToken, accessToken, accessSecret, JSON.parse(data));
        });
    };

    async.seq(findRequestToken, getAccessToken, getUserData)(function (err, requestToken, accessToken, accessSecret, data) {
        if (err) return next(err);

        // delete request token
        requestToken.remove();

        // store access token, updating if an existing one is present for that
        // user
        AccessToken.findOneAndUpdate({
            user: data["id"]
        }, {
            token: accessToken,
            secret: accessSecret,
            user: data["id"],
            name: data["screen_name"] // screen name
        }, { upsert: true }, function (err) {
            if (err) return next(err);

            res.render("authenticated");
        });
    });
});

// attempt to post a humorous tweet for all accounts we have
// access to
twitter.get("/tweet", function (req, res, next) {
    // try and tweet for each access token we have
    AccessToken.find(function (err, tokens) {
        async.map(tokens, function (token, callback) {
            oauth.post("https://api.twitter.com/1.1/statuses/update.json", token["token"], token["secret"], {
                // test status
                status: util.format("I am a Twitter bot, and the current date/time is %s", new Date())
            }, function (err) {
                // don't error if tweeting from an individual account fails, but just record
                // the accounts which did successfully post
                if (err) return callback(null);
                return callback(null, token["name"]);
            });
        }, function (err, names) {
            if (err) return next(err);

            res.render("tweeted", { names: names });
        });
    });
});
