var test = require('tape');
var got = require('got');
var crypto = require('crypto');
var assign = require('object-assign');
var mock = require('../');
var mockPromised = require('../promise');
var responseTemplate = require('../responseTemplate.json');

var token = 'MySecretToken';
var defaultHeaders = { Authorization: 'Bearer ' + token };
var req = function(path, opts) {
  return got(
    /https?:\/\//.test(path) ? path : 'http://localhost:63142' + path,
    assign({ timeout: 150, headers: defaultHeaders }, opts || {})
  );
};

var server;
test('boot', function(t) {
  mock(function(err, httpServer) {
    if (err) {
      return t.fail(err);
    }

    server = httpServer;
    t.end();
  });
});

test('403s without a token', function(t) {
  req('/meh', { headers: {} })
    .then(function(res) {
      t.fail('Did not 403 as expected');
    })
    .catch(function(err) {
      t.equal(err.statusCode, 403);
    })
    .then(t.end);
});

test('405s on non-GETs', function(t) {
  req('/@mockscope%2Ffoobar', { method: 'POST' })
    .then(function(res) {
      t.fail('Did not 405 as expected');
    })
    .catch(function(err) {
      t.equal(err.statusCode, 405);
    })
    .then(t.end);
});

test('404s on unknown URLs', function(t) {
  req('/blahtti')
    .then(function(res) {
      t.fail('Did not 404 as expected');
    })
    .catch(function(err) {
      t.equal(err.statusCode, 404);
    })
    .then(t.end);
});

test('returns package response on valid package request', function(t) {
  req('/@mockscope%2Ffoobar', { json: true })
    .then(function(res) {
      var body = res.body;
      var shasum =
        body &&
        body.versions &&
        body.versions['1.0.0'] &&
        body.versions['1.0.0'].dist &&
        body.versions['1.0.0'].dist.shasum;

      t.equal(shasum, responseTemplate.versions['1.0.0'].dist.shasum);
    })
    .catch(function(err) {
      t.fail('Did not 200 as expected (' + err.message + ')');
    })
    .then(t.end);
});

test('returns tarball on valid tarball request', function(t) {
  req('/@mockscope/foobar/-/foobar-1.0.0.tgz', { encoding: null })
    .then(function(res) {
      var shasum = crypto
        .createHash('sha1')
        .update(res.body)
        .digest('hex');
      t.equal(shasum, responseTemplate.versions['1.0.0'].dist.shasum);
    })
    .catch(function(err) {
      t.fail('Did not 200 as expected (' + err.message + ')');
    })
    .then(t.end);
});

test('returned tarball url is downloadable', function(t) {
  req('/@mockscope%2Ffoobar', { json: true })
    .then(function(res) {
      var body = res.body;
      var tarball =
        body &&
        body.versions &&
        body.versions['1.0.0'] &&
        body.versions['1.0.0'].dist &&
        body.versions['1.0.0'].dist.tarball;

      req(tarball, { encoding: null })
        .then(function(tarRes) {
          var shasum = crypto
            .createHash('sha1')
            .update(tarRes.body)
            .digest('hex');
          t.equal(shasum, responseTemplate.versions['1.0.0'].dist.shasum);
        })
        .catch(function(err) {
          t.fail('Tarball request failed: ' + err.message);
        })
        .then(t.end);
    })
    .catch(function(err) {
      t.fail('Did not 200 as expected (' + err.message + ')');
    });
});

test('shutdown', function(t) {
  server.close(t.end);
});

test('has promise api', function(t) {
  mockPromised().then(function(httpServer) {
    req('/@mockscope%2Ffoobar', { json: true })
      .then(function(res) {
        t.equal(res.body.name, '@mockscope/foobar');
      })
      .catch(function(err) {
        t.fail('Did not 200 as expected (' + err.message + ')');
      })
      .then(function() {
        httpServer.close(t.end);
      });
  });
});

test('can be configured to use alternative package name', function(t) {
  mockPromised({ pkgName: '@otherscope/some-module' }).then(function(httpServer) {
    req('/@otherscope%2Fsome-module', { json: true })
      .then(function(res) {
        t.equal(res.body.name, '@otherscope/some-module');
      })
      .catch(function(err) {
        t.fail('Did not 200 as expected (' + err.message + ')');
      })
      .then(function() {
        httpServer.close(t.end);
      });
  });
});
