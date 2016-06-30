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
   * @param {Object} [options]
   * @private
   * @access private
   */
  function registerFile(namespace, file, options) {
    var cleanedFile = cleanFile(file, options),
      moduleNamespace;

    moduleNamespace = Pregister.file2namespace(file, namespace);  // cut sufix

    // load module
    try {
      register(moduleNamespace, require(cleanedFile), options);
    } catch (err) {
      console.error('PREGISTER Error on require: \n', cleanedFile, '\n\n', err.stack || err);
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
      moduleRequire = moduleRequire.default || moduleRequire;
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
    done && done();
  }

  /**
   *
   * @param {String}   namespace           - if not set, then use root node
   * @param {*}        part                - register module in bucket scope
   * @param {Object}   [options]           - Call Module as Singleton
   * @param {Function} [options.singleton] - Call Module as Singleton
   *
   * @private
   * @access private
   *
   * @throws Error
   *
   * @returns {void}
   */
  function register(namespace, part, options) {
    var scope = bucket, moduleName, moduleNamespace;

    if(!namespace) {
      throw new Error('Namespace can not be empty');
    }

    moduleNamespace = namespace.split('.');

    // get last node and
    // transform my-function to myFunction
    moduleName = moduleNamespace.pop().replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });

    // create object path
    moduleNamespace.forEach(function (node) {
      scope = scope[node] = scope[node] || {};
    });

    // prevent duplicate register module
    if (scope[moduleName]) {
      throw new Error('Module "' + moduleName + '" in Namespace "' + namespace + '" exist');
    }

    debug({
      namespace:       namespace,
      moduleNamespace: moduleNamespace,
      moduleKey:       moduleName
    });

    if(options && options.singleton) {
      scope[moduleName] = options.singleton(part.default || part);
    } else {
      // load module
      scope[moduleName] = part.default || part;
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
     * @param {Object|Function} [options] - glob options or intern options
     * @param {Function}        [done]
     */
    require: function (namespace, pattern, options, done) {
      var resolvable;
      options = options || {};

      if (typeof options === 'function') {
        done = options;
        options = {};
      }

      if(typeof pattern === 'object') {
        return register(namespace, pattern, options);
      }

      try{
        require.resolve(pattern);
        resolvable = true;
      } catch(error) {
        resolvable = false;
      }

      if(resolvable) {
        return register(namespace, require(pattern), options);
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
     * @param {String}   namespace
     * @param {*}        part
     * @param {Object}   [options]
     * @param {Function} [options.singleton]
     */
    register: function(namespace, part, options) {
      return register(namespace, part, options);
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
     * @param {String}   pattern       - glob pattern
     * @param {Object}   options       - glob options
     * @param {String}   [options.cwd] - cwd path
     * @param {Function} [done]        - callback
     */
    call: function (pattern, options, done) {
      async.each(
        glob.sync(pattern, options) || [], function (file, done) {
          callFile(file, options, done);
        }, done || function () {}
      );
    },

    /**
     *
     * @param {String} file
     * @param {String} namespace
     */
    file2namespace: function(file, namespace) {
      var path = file
        .replace(/(\/)/g, '.')   // replace / => .
        .replace(/\.\w+$/, '')   // cut extension .js
        .replace(/\.index$/, '') // remove default index module name
        .replace(/^\.|\.$/, ''); // trim .

      return (namespace + '.' + path.replace(new RegExp('(.*)\\.+' + namespace, 'i'), namespace))
        .replace(new RegExp('\\.' + namespace), '').replace(/\.{2,}/, '.');
    }
  };
})();

module.exports = Pregister;