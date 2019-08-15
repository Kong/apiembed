/* eslint-env node, mocha */

"use strict";

var app = require("./app");
var cluster = require("cluster");
var os = require("os");

var WORKERS = process.env.WEB_CONCURRENCY || os.cpus().length;

if (cluster.isMaster) {
  // Spawn as many workers as there are CPUs in the system.
  for (var i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", function(worker/*, code, signal*/) {
    console.info("worker", worker.process.pid, "died :(");
    console.info("spawning a new worker");
    cluster.fork();
  });
} else {
  app(function() {
    console.info("spawning worker #" + cluster.worker.id);
  });
}
