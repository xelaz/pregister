"use strict";

var assert = require("assert"),
  Pregister = require('../index.js');

describe('Data', function() {

  it('should require modules into namesace', function () {

    Pregister.require('async');
    Pregister.require('abrakadabra');

  });
});