"use strict";

var assert = require("assert"),
  Pregister = require('../index.js');

describe('Data', function() {

  it('should require modules into namesace', function () {

    Pregister.require('async', 'async');
    Pregister.require('abrakadabra', 'muhahaha');
    Pregister.require('../example/special', 'mymodule');
    Pregister.require(require('../example/special'), 'special');

    console.log(Pregister);

  });
});