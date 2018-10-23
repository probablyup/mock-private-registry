var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');
var assign = require('object-assign');
var responseTemplate = require('./responseTemplate.json');

function generatePackageResponse(package, hostname, port) {
  var tpl = assign({}, responseTemplate, {
    _id: package.name,
    name: package.name,
  });

  tpl.versions['1.0.0'] = assign({}, tpl.versions['1.0.0'], {
    _id: package.name + '@1.0.0',
    name: package.name,
    dist: assign({}, tpl.versions['1.0.0'].dist, {
      shasum: package.sha,
      tarball: ['http://' + hostname + ':' + port, package.name, '-', package.moduleName + '-1.0.0.tgz'].join('/'),
    }),
  });

  return tpl;
}

function softEncode(pkg) {
  return encodeURIComponent(pkg).replace(/^%40/, '@');
}

function sha1(data) {
  return crypto
    .createHash('sha1')
    .update(data)
    .digest('hex');
}

function ucEnc(str) {
  return str.replace(/(%[a-f0-9]{2})/g, function(match) {
    return match.toUpperCase();
  });
}

module.exports = function(options, callback) {
  var debug = options.debug || false;

  /**
   * Synthesize the URLs and sha of each mocked module to make matching easier later.
   */
  var packages = (options.packages || ['@mockscope/foobar', path.join(__dirname, 'mock.tgz')]).reduce(
    (pkgs, [name, filePath]) => {
      pkgs.push({
        moduleName: name.slice(name.indexOf('/') + 1),
        name,
        path: '/' + softEncode(name),
        tarballFilePath: filePath,
        tarballPath: `/${name}/-/${name.slice(name.indexOf('/') + 1)}-1.0.0.tgz`,
        sha: sha1(fs.readFileSync(filePath, { encoding: null })),
      });

      return pkgs;
    },
    []
  );

  var hostname = options.hostname || '127.0.0.1';
  var port = options.port || 63142;
  var token = options.token || 'MySecretToken';
  var tokenType = options.tokenType || 'Bearer';

  var server = http.createServer(function(req, res) {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (!req.headers.authorization) {
      res.writeHead(403, 'Missing authorization header', { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authorization header missing' }));
      return;
    }

    var authToken = req.headers.authorization.split(' ', 2);
    var correctTokenType = authToken[0] === tokenType;
    var correctToken = authToken[1] === token;

    if (!correctTokenType || !correctToken) {
      var message = 'Incorrect token';
      res.writeHead(403, message, { 'Content-Type': 'application/json' });

      if (debug) {
        message += correctTokenType ? '' : '\nExpected token type "' + tokenType + '", got "' + authToken[0] + '"';
        message += correctToken ? '' : '\nExpected token "' + token + '", got "' + authToken[1] + '"';
      }

      res.end(JSON.stringify({ error: message }));
      return;
    }

    const foundPackage = packages.find(x => x.path === ucEnc(req.url) || x.tarballPath === req.url);

    /**
     * Requesting package metadata
     */
    if (foundPackage && ucEnc(req.url) === foundPackage.path) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(generatePackageResponse(foundPackage, hostname, port)));
      return;
    }

    /**
     * Requesting package tarball
     */
    if (foundPackage && req.url === foundPackage.tarballPath) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      fs.createReadStream(foundPackage.tarballFilePath).pipe(res);
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'File Not Found' }));
  });

  server.listen(port, hostname, function() {
    callback(null, server, packages);
  });
};
