const path = require("path");

module.exports = {
  webpack: config => {
    config.module.rules.push({
      test: /\.rs$/,
      use: {
        loader: "rust-loader"
      }
    })

    config.resolveLoader = config.resolveLoader || {};
    config.resolveLoader.alias = config.resolveLoader.alias || {};
    config.resolveLoader.alias["rust-loader"] = path.join(__dirname, './rustLoader');

    return config;
  }
}
