const child_process = require("child_process");
const fs = require("fs");
const path = require("path");

// Loader for rust files, compiles them and exports a function "prepare", which
// resolves to a Wasm instance
module.exports = function(source) {
  const callback = this.async();

  const wasmFile = __dirname + "/out.wasm"; // can be anywhere writable
  const wasmFileTemp = __dirname + "/out-temp.wasm"; // can be anywhere writable

  const cmd = `rustc +nightly --crate-type=cdylib --target=wasm32-unknown-unknown -O ${
    this.resourcePath
  } -o ${wasmFileTemp} && wasm-gc ${wasmFileTemp} ${wasmFile}`;
  const self = this;
  child_process.exec(cmd, {}, function(error, stdout, stderr) {
    if (error)
      return callback(error, null);

    const content = fs.readFileSync(wasmFile);
    const content64 = content.toString("base64");

    const code = `module.exports = (function(data) {
      return {
        prepare: function(options) {
          if (!options) options = {};
          const bytes = new Buffer(data, 'base64');
          return WebAssembly.compile(bytes)
            .then(function(wasmModule) {
              return WebAssembly.instantiate(wasmModule, options);
            });
        }
      }
    })("${content64}")`;

    fs.unlinkSync(wasmFile);
    fs.unlinkSync(wasmFileTemp);

    return callback(null, code);
  });
};
