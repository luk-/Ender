/*!
 * ENDER - The open module JavaScript framework
 *
 * Copyright (c) 2011-2012 @ded, @fat, @rvagg and other contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished
 * to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


/******************************************************************************
 * The SourcePackage object, each instance is associated with an npm package.
 * The object uses the package.json and commandline options to figure out how
 * to assemble an output via the asString() method.
 * Internally we use EJS templates to augment the source to provide an Ender-
 * compatible output (the less screwing with strings here the better).
 */

var fs                = require('fs')
  , path              = require('path')
  , async             = require('async')
  , packageUtil       = require('./package-util')
  , util              = require('./util')
  , FilesystemError   = require('./errors').FilesystemError

  , SourcePackage = {
        init: function (name, parents, descriptor, options) {
          var exposedPackageNames = util.getExposedPackageNames(options)
            
          this.name        = name
          this.parents     = parents
          this.descriptor  = descriptor

          this.isBare = !!(descriptor && descriptor.bare)
          this.isExposed = (!options.sandbox ||
                            exposedPackageNames.indexOf(this.root) != -1 ||
                            exposedPackageNames.indexOf(this.name) != -1)
          return this
        }

        // not the overridden name, the name from the unmodified descriptor
      , get originalName () {
          return this.descriptor &&
                 Object.getPrototypeOf(this.descriptor).name ||
                 this.name
        }

        // the root of this package on the filesystem
      , get root () {
          return packageUtil.getPackageRoot(this.parents, this.originalName)
        }

        // get the `name` from the original json data, available as proto (see package-descriptor.js)
      , get identifier () {
          return this.originalName + '@' + this.descriptor.version
        }

      , loadSources: function (callback) {
          var readers = {}
            , addReader = function (file) {
                file = path.normalize(file).replace(/\.js$/, '')
                readers[file] = fs.readFile.bind(null, path.join(this.root, file + '.js'), 'utf-8')
                return file
              }.bind(this)
          
          if (this.descriptor) {
            if (this.descriptor.files)
              this.descriptor.files.forEach(addReader)
          
            if (this.descriptor.main)
              this.main = addReader(this.descriptor.main)
          
            if (this.descriptor.ender)
              this.bridge = addReader(this.descriptor.ender)
          }

          async.parallel(
            readers,
            function (err, sources) {
              if (err) return callback(new FilesystemError(err))
              this.sources = sources
              callback(null, this)
            }.bind(this)
          )
        }
        
      , extendOptions: function (options) {
          var externs = this.descriptor && this.descriptor.externs
            , root = this.root

          if (externs) {
            if (!Array.isArray(externs)) externs = [ externs ]
            if (!options.externs) options.externs = []
            options.externs = options.externs.concat(externs.map(function (e) {
              return path.join(root, e)
            }))
          }
        }
    }
  , create = function (name, parents, descriptor, options) {
      return Object.create(SourcePackage).init(name, parents, descriptor, options)
    }


module.exports = {
    create: create
}
