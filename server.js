'use strict';

var compression     = require('compression');
var debug           = require('debug')('apiembed');
var express         = require('express');
var morgan          = require('morgan');

// load .env
require('dotenv').load();

// express setup
var app = express();
app.set('view engine', 'jade');
app.enable('view cache');
app.disable('x-powered-by');

// add 3rd party middlewares
app.use(compression());

if (!process.env.QUIET && !process.env.npm_package_config_quiet) {
  app.use(morgan('dev'));
}

// define static files path
app.use('/static', express.static(__dirname + '/../static'));

app.get('/', function (req, res) {
  res.send('handle get');
});

app.post('/', function (req, res) {
  res.send('handle post');
});

app.listen(process.env.PORT || process.env.npm_package_config_port);
