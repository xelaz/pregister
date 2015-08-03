"use strict";

var assert = require("assert"),
  Pregister = require('../index.js');

describe('Namespace', function() {

  it('should mix namespace with file', function () {
    assert.equal('service.db', Pregister.file2namespace('service/db/index.js', 'service'));
    assert.equal('service.db', Pregister.file2namespace('service/db/index.js', 'service.db'));
    assert.equal('service.db', Pregister.file2namespace('service/db/index.js', 'service.db'));
    assert.equal('service.db', Pregister.file2namespace('root/service/db/index.js', 'service.db'));
    assert.equal('service.db', Pregister.file2namespace('root/service/db.js', 'service.db'));
    assert.equal('service.db', Pregister.file2namespace('/root/service/db.js', 'service.db'));
  });
});