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
  debug = require('debug')('pregister');

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

    moduleRequire = null;
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
    }

    // with wrapper
    if (moduleRequire && typeof options.invoke === 'function') {
      try {
        options.invoke.call(undefined, moduleRequire);
      } catch (err) {
        console.error('PREGISTER Error on wrapper: \n', cleanFile(file, options), '\n\n', err.stack || err);
      }
    } else if(moduleRequire) {
      try {
        var args = (Array.isArray(options.args) && options.args.concat()) || [];
        moduleRequire.apply && moduleRequire.apply(undefined, args);
      } catch (err) {
        console.error('PREGISTER ERROR apply: \n', cleanFile(file, options), '\n\n', err.stack || err);
      }
    }
    moduleRequire = null;
    // all is okay
    done();
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
        return register(namespace, pattern);
      }

      try{
        require.resolve(pattern);
        resolvable = true;
      } catch(error) {
        resolvable = false;
      }

      if(resolvable) {
        return register(namespace, require(pattern));
      }

      if (typeof options === 'function') {
        done = options;
        options = {};
      }

      async.each(glob.sync(pattern, options) || [], function (file, done) {
        registerFile(namespace, file, options);
        done();
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
     *
     * @param {String} namespace
     *
     * @returns {Pregister}
     */
    remove: function(namespace) {
      var path = namespace.split('.');
      var last = path.pop();
      var data = bucket;

      path.forEach(function(path) {
        data = data[path];
      });

      delete data[last];

      return this;
    },

    /**
     * @returns {Pregister}
     */
    reset: function() {
      bucket = {};

      return this;
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
          callFile(file, options, done);
        }, done || function () {
        });
    }
  };
})();

module.exports = Pregister;