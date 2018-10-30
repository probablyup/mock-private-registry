# @probablyup/mock-private-registry

Mock of a private npm registry, useful for testing npm-related stuff. This is a fork of "mock-private-registry" with support for mocking multiple packages.

## Installation

```
npm install --save-dev @probablyup/mock-private-registry
```

## Usage

```js
const registry = require('@probablyup/mock-private-registry');
const got = require('got');

const token = 'MySecretToken';

// make the tarballs by running `npm pack` in it
const packages = [
  ['my-package', '/absolute/path/to/private/package/tarball.tar.gz'],
  ['my-other-package', '/absolute/path/to/other/private/package/tarball.tar.gz'],
];

registry({ packages, port: 18888, token }, function(err, server) {
  if (err) {
    throw err;
  }

  const opts = { headers: { Authorization: 'Bearer ' + token }, json: true };

  got('http://localhost:18888/@mockscope%2Ffoobar', opts)
    .then(function(res) {
      console.log('Package manifest: ', res.body);
    })
    .catch(function(err) {
      console.error(err);
    })
    .then(function() {
      server.close();
    });
});
```

Basically, call the module to spin up a server, and specify whatever you want to use as the valid authorization token. Second argument is a callback, which provides access to the server that is listening. This allows you to call `close()` on it when you're done.

## Options

- `port` - Port number for the server. Default: `63142`

- `hostname` - Hostname the server should listen on. Default: `127.0.0.1`

- `token` - The token that valid requests should use. Default: `MySecretToken`

- `tokenType` - Type of token. Usually `Bearer` or `Basic`. Default: `Bearer`

- `packages` - A two dimensional array of package name and tarball path, e.g.

  ```
  [['foo-package', '/local/path/to/foo-package.tar.gz']]
  ```

- `debug` - Boolean. Set to true in order to have the registry mock spit back whatever is not matching, for instance the expected vs received token. Default: `false`

## Promise API

There is an alternative promise API available if you require `@probablyup/mock-private-registry/promise`. Usage is the same except there is no callback. Instead, the function will return a promise.

## Why

For testing. Lots of stuff interacts with the NPM registry, but often has bugs when authorizing against private registries. Trying to mock the whole private registry flow can be difficult, so I created this.

## License

MIT
