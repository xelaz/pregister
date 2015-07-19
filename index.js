"use strict";

var glob = require('glob'),
  path = require('path'),
  mpath = require('mpath'),
  async = require('async'),
  debug = require('debug')('pregister'),
  domain = require('domain').create();

domain.on('error', function (err) {
  console.error('PregisterDomainError: \n', err.stack || err || '');
});

var Pregister = (function () {
  /**
   *
   * @param {String} file
   * @param {Object} options
   * @private
   * @access private
   * @returns {*}
   */
  function cleanFile(file, options) {
    options = options || {};
    var cwd = options.cwd || process.cwd();
    return path.join(cwd, path.normalize(file).replace(cwd, ''));
  }

  /**
   *
   * @param {String} namespace
   * @param {String} file
   * @param {Object} options
   * @private
   * @access private
   * @returns {void}
   */
  function addFile(namespace, file, options) {
    var cleanedFile = cleanFile(file, options), module, moduleNamespace;

    // load module
    try {
      module = require(cleanedFile);
    } catch (err) {
      return console.error('PREGISTER Error on require: \n', cleanFile(file, options), '\n\n', err.stack || err);
    }

    if(!module.namespace) {
      var fullN = file
        .replace(/(\/)/g, '.')
        .replace(/\.\w+$/, '')
        .replace(/\.index$/, '')
        .replace(new RegExp('(.*)\\.?' + namespace, 'i'), namespace);

      // use global scope
      var scope = Pregister;
      moduleNamespace = fullN.split('.');
    } else {
      moduleNamespace = module.namespace.split('.');
    }

    // transform my-function to myFunction
    var moduleKey = moduleNamespace.pop().replace(/-([a-z])/g, function (g) {
      return g[1].toUpperCase();
    });

    // create object path
    moduleNamespace.forEach(function (node) {
      scope[node] = scope[node] || {};
      scope = scope[node];
    });

    // prevent duplicate register module
    if (scope[moduleKey]) {
      debug('PregisterModuleExist: \n' +  moduleKey + '::' + cleanedFile);
      return
    }

    debug({
      cleanedFile:     cleanedFile,
      fullN:           fullN,
      moduleNamespace: moduleNamespace,
      moduleKey:       moduleKey
    });

    // load module
    scope[moduleKey] = require(cleanedFile);
  }

  /**
   *
   * @param {String} file
   * @param {Object} options
   * @param {Function} done
   * @private
   * @access private
   * @returns {void}
   */
  function callFile(file, options, done) {
    var module;
    debug('CALL - %s', file);

    // load module
    try {
      module = require(cleanFile(file, options));
    } catch (err) {
      console.error('PREGISTER Error on require: \n', cleanFile(file, options), '\n\n', err.stack || err);
      return done();
    }

    // with wrapper
    if (options.args && typeof options.args === 'function') {
      try {
        options.args.apply(undefined, [module, done]);
      } catch (err) {
        console.error('PREGISTER Error on wrapper: \n', cleanFile(file, options), '\n\n', err.stack || err);
        return done();
      }
    } else {
      try {
        module.apply && module.apply(undefined, options.args || []);
      } catch (err) {
        console.error('PREGISTER ERROR apply: \n', cleanFile(file, options), '\n\n', err.stack || err);
        return done();
      }

      // all is okay
      done();
    }
  }

  return Object.create(Object.prototype, {

    register: {
      /**
       * @function
       * @public
       * @access public
       *
       * @param {String}          namespace
       * @param {String}          pattern
       * @param {Object|Function} options
       * @param {Function|null}   done
       */
      value: function (namespace, pattern, options, done) {
        if (typeof options === 'function') {
          done = options;
          options = {};
        }

        async.each(glob.sync(pattern, options) || [], function (file, done) {
          domain.run(function () {
            addFile(namespace, file, options);
            done();
          });
        }, done);
      }
    },

    /**
     * @function
     * @public
     * @access public
     *
     * @param {String} namespace
     */
    resolve: {
      value: function (namespace, def) {
        var res = mpath.get(namespace, Pregister);

        if (!res) {
          throw new Error('PregisterResolveError: ' + namespace);
        }

        return res || def || undefined;
      }
    },

    call: {
      /**
       *
       * @function
       *
       * @public
       * @access private
       *
       * @param {String}   pattern
       * @param {Object}   options
       * @param {Function} done
       */
      value: function (pattern, options, done) {
        async.each(
          glob.sync(pattern, options) || [], function (file, done) {
            domain.run(function () {
              callFile(file, options, done);
            });
          }, done || function () {
          });
      }
    }
  });
})();

module.exports = Pregister;