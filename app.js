/* eslint-env node, mocha */

"use strict";

var compression = require("compression");
var debug = require("debug")("apiembed");
var express = require("express");
var HTTPSnippet = require("httpsnippet");
var morgan = require("morgan");
var unirest = require("unirest");
var join = require("path").join;

module.exports = function(callback) {
  var availableTargets = HTTPSnippet.availableTargets().reduce(function(
    targets,
    target
  ) {
    if (target.clients) {
      targets[target.key] = target.clients.reduce(function(clients, client) {
        clients[client.key] = false;
        return clients;
      }, {});
    } else {
      targets[target.key] = false;
    }

    return targets;
  },
  {});

  var namedTargets = HTTPSnippet.availableTargets().reduce(function(
    targets,
    target
  ) {
    if (target.clients) {
      targets[target.key] = target;

      targets[target.key].clients = target.clients.reduce(function(
        clients,
        client
      ) {
        clients[client.key] = client;
        return clients;
      },
      {});
    } else {
      targets[target.key] = target;
    }

    return targets;
  },
  {});

  var APIError = function(code, message) {
    this.name = "APIError";
    this.code = code || 500;
    this.message = message || "Oops, something went wrong!";
  };

  APIError.prototype = Error.prototype;

  // express setup
  var app = express();
  app.set("view engine", "pug");
  app.disable("x-powered-by");

  if (!process.env.NOCACHE) {
    app.enable("view cache");
  }

  // logging
  app.use(morgan("dev"));

  // add 3rd party middlewares
  app.use(compression());

  // useful to get info in the view
  app.locals.HTTPSnippet = HTTPSnippet;
  app.locals.namedTargets = namedTargets;

  // enable CORS
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });

  // static middleware does not work here
  app.use("/favicon.ico", function(req, res) {
    res.sendFile(join(__dirname, "/static/favicon.ico"));
  });

  // static middleware does not work here
  app.use("/targets", function(req, res) {
    res.json(HTTPSnippet.availableTargets());
  });

  app.get("/", function(req, res, next) {
    var source = decodeURIComponent(req.query.source);
    var targets = req.query.targets || "all";

    if (!source) {
      return next(new APIError(400, "Invalid input"));
    }

    debug("received request for source: %s & targets: %s", source, targets);

    // parse the requested targets
    // TODO this needs optimization
    var requestedTargets = targets.split(",").reduce(function(requested, part) {
      var i = part.split(":");

      var target = i[0] || "all";
      var client = i[1] || "all";

      // all targets
      if (target === "all") {
        // set all members to true
        return Object.keys(availableTargets).reduce(function(output, current) {
          if (typeof availableTargets[current] === "object") {
            output[current] = Object.keys(availableTargets[current]).reduce(
              function(clients, currentClient) {
                clients[currentClient] = true;
                return clients;
              },
              {}
            );
          } else {
            output[current] = true;
          }

          return output;
        }, {});
      }

      // all clients?
      if (availableTargets.hasOwnProperty(target)) {
        if (typeof availableTargets[target] === "object") {
          if (client === "all") {
            requested[target] = Object.keys(availableTargets[target]).reduce(
              function(clients, currentClient) {
                clients[currentClient] = true;
                return clients;
              },
              {}
            );
          } else {
            if (availableTargets[target].hasOwnProperty(client)) {
              requested[target] = requested[target] ? requested[target] : {};
              requested[target][client] = true;
            }
          }
        } else {
          requested[target] = true;
        }

        return requested;
      }

      return requested;
    }, {});

    unirest
      .get(source)
      .headers({ Accept: "application/json" })
      .end(function(response) {
        if (response.error) {
          debug(
            "failed to load source over http: %s %s",
            response.code || response.error.code,
            response.status || response.error.message
          );

          return next(new APIError(400, "Could not load JSON source"));
        }

        var snippet;
        var output = {};

        if (typeof response.body !== "object") {
          try {
            response.body = JSON.parse(response.body);
          } catch (err) {
            debug(
              "failed to parse content of %s, with error: %s",
              source,
              err.message
            );

            return next(new APIError(400, "Invalid JSON source"));
          }
        }

        try {
          snippet = new HTTPSnippet(response.body);
        } catch (err) {
          debug("failed to generate snippet object: %s", err.message);

          return next(new APIError(400, err));
        }

        Object.keys(requestedTargets).map(function(target) {
          var outputTarget = target.replace(/\./, "_");

          if (typeof requestedTargets[target] === "object") {
            output[outputTarget] = {};

            return Object.keys(requestedTargets[target]).map(function(client) {
              var outputClient = client.replace(/\./, "_");
              output[outputTarget][outputClient] = snippet.convert(target, client);
            });
          }

          output[outputTarget] = snippet.convert(target);
        });

        if (Object.keys(output).length === 0) {
          debug("no matching targets found");

          return next(new APIError(400, "Invalid Targets"));
        }

        res.render("main", {
          output: output
        });

        res.end();
      });
  });

  // error handler
  app.use(function errorHandler(error, req, res/*, next */) {
    if (error.code === 400) {
      error.message +=
        ", please review the <a href=\"https://apiembed.com/#docs\" target=\"_blank\">documentation</a> and try again";
    }

    // never show a 40x
    res.status(200);
    res.render("error", error);
  });

  app.listen(process.env.PORT || process.env.npm_package_config_port);

  if (typeof callback === "function") {
    callback();
  }
};
