'use strict'

var app = require('./app')
var cluster = require('cluster')
var debug = require('debug')('apiembed')
var os = require('os')

var WORKERS = process.env.WEB_CONCURRENCY || os.cpus().length

if (cluster.isMaster) {
  // Spawn as many workers as there are CPUs in the system.
  for (var i = 0; i < WORKERS; i++) {
    cluster.fork()
  }

  cluster.on('exit', function (worker, code, signal) {
    debug('worker', worker.process.pid, 'died :(')
    debug('spawning a new worker')
    cluster.fork()
  })
} else {
  app(function () {
    debug('spawning worker #' + cluster.worker.id)
  })
}
