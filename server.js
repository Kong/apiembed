'use strict';

var compression = require('compression');
var debug       = require('debug')('apiembed');
var express     = require('express');
var httpsnippet = require('httpsnippet');
var morgan      = require('morgan');
var unirest     = require('unirest');
var util        = require('util');

// load .env
require('dotenv').load();

// express setup
var app = express();
app.set('view engine', 'jade');
// app.enable('view cache');
app.disable('x-powered-by');

// add 3rd party middlewares
app.use(compression());

if (!process.env.QUIET && !process.env.npm_package_config_quiet) {
  app.use(morgan('dev'));
}

// define static files path
app.use('/static', express.static(__dirname + '/../static'));

app.get('/', function (req, res) {
  var source = req.query.source;
  var targets = req.query.target;

  // force formatting
  if (!util.isArray(targets)) {
    targets = new Array(targets);
  }

  if (~targets.indexOf('all')) {
    targets = httpsnippet._targets();
  }

  unirest.get(source).end(function (response) {
    var source = JSON.parse(response.body);

    var output = {};

    var snippet = new httpsnippet(source);

    targets.map(function (target) {
      output[target] = snippet[target].apply(snippet);
    });

    res.render('main', {
      output: output
    });
  });
});

app.post('/', function (req, res) {
  res.send('handle post');
});

app.listen(process.env.PORT || process.env.npm_package_config_port);
