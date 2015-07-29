"use strict";

/**
 * Callback as node pattern callbacks.
 *
 * @callback callbackPattern
 *
 * @returns {void}
 */

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

  var bucket = {};

  /**
   *
   * @param {String} file
   * @param {Object} [options]
   * @param {String} [options.cwd]
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
   */
  function registerFile(namespace, file, options) {
    var cleanedFile = cleanFile(file, options),
      moduleRequire,
      moduleNamespace;

    moduleNamespace = file
      .replace(/(\/)/g, '.')                                        // replace / => .
      .replace(/\.\w+$/, '')                                        // cut extension .js
      .replace(/\.index$/, '')                                      // cut index as module name
      .replace(new RegExp('(.*)\\.?' + namespace, 'i'), namespace); // cut sufix

    // load module
    try {
      moduleRequire = require(cleanedFile);
      register(moduleNamespace, moduleRequire);
    } catch (err) {
      console.error('PREGISTER Error on require: \n', cleanFile(file, options), '\n\n', err.stack || err);
    }
  }

  /**
   *
   * @param {String} file
   * @param {Object} options
   * @param {callbackPattern} done
   * @private
   * @access private
   * @returns {void}
   */
  function callFile(file, options, done) {
    var moduleRequire;
    debug('CALL - %s', file);

    // load module
    try {
      moduleRequire = require(cleanFile(file, options));
    } catch (err) {
      console.error('PREGISTER Error on require: \n', cleanFile(file, options), '\n\n', err.stack || err);
      return done();
    }

    // with wrapper
    if (options.args && typeof options.args === 'function') {
      try {
        options.args.apply(undefined, [moduleRequire, done]);
      } catch (err) {
        console.error('PREGISTER Error on wrapper: \n', cleanFile(file, options), '\n\n', err.stack || err);
        return done();
      }
    } else {
      try {
        moduleRequire.apply && moduleRequire.apply(undefined, options.args || []);
      } catch (err) {
        console.error('PREGISTER ERROR apply: \n', cleanFile(file, options), '\n\n', err.stack || err);
        return done();
      }

      // all is okay
      done();
    }
  }

  /**
   *
   * @param {*}      part        - register module in bucket scope
   * @param {String} [namespace] - if not set, then use root node
   *
   * @private
   * @access private
   *
   * @throws Error
   *
   * @returns {void}
   */
  function register(namespace, part) {
    var scope = bucket, moduleName, moduleNamespace;

    if(!namespace) {
      throw new Error('Namespace can not be empty');
    }

    moduleNamespace = namespace.split('.');

    // get last node and
    // transform my-function to myFunction
    moduleName = moduleNamespace.pop().replace(/-([a-z])/g, function (g) {
      return g[1].toUpperCase();
    });

    // create object path
    moduleNamespace.forEach(function (node) {
      scope[node] = scope[node] || {};
      scope = scope[node];
    });

    // prevent duplicate register module
    if (scope[moduleName]) {
      debug('PregisterModuleExist: \n' +  moduleName);
    } else {
      debug({
        namespace:       namespace,
        moduleNamespace: moduleNamespace,
        moduleKey:       moduleName
      });

      // load module
      scope[moduleName] = part;
    }
  }

  return {
    /**
     * @method
     * @public
     * @access public
     *
     * @param {String}          namespace
     * @param {String}          pattern
     * @param {Object|Function} [options]
     * @param {Function}        [done]
     */
    require: function (namespace, pattern, options, done) {
      var resolvable;

      if(typeof pattern === 'object') {
        register(namespace, pattern);
        return;
      }

      try{
        require.resolve(pattern);
        resolvable = true;
      } catch(error) {
        resolvable = false;
      }

      if(resolvable) {
        register(namespace, require(pattern));
        return;
      }

      if (typeof options === 'function') {
        done = options;
        options = {};
      }

      async.each(glob.sync(pattern, options) || [], function (file, done) {
        domain.run(function () {
          registerFile(namespace, file, options);
          done();
        });
      }, done);
    },

    /**
     * @method
     * @public
     * @access public
     *
     * @param {*}          part
     * @param {String}     namespace
     */
    register: function(namespace, part) {
      return register(namespace, part);
    },

    /**
     * @method
     * @public
     * @access public
     *
     * @param {String|undefined} namespace
     * @param {*|undefined}     [def]     - dafault
     */
    resolve: function (namespace, def) {
      var res = (!namespace) ? bucket : mpath.get(namespace, bucket);

      if (!res && !def) {
        throw new Error('PregisterResolveError: ' + namespace);
      }

      return res || def;
    },

    /**
     * @method
     *
     * @public
     * @access private
     *
     * @param {String}   pattern
     * @param {Object}   options
     * @param {Function} [done]
     */
    call: function (pattern, options, done) {
      async.each(
        glob.sync(pattern, options) || [], function (file, done) {
          domain.run(function () {
            callFile(file, options, done);
          });
        }, done || function () {
        });
    }
  };
})();

module.exports = Pregister;