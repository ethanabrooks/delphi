const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add resolver fallbacks for missing async-require
config.resolver.resolverMainFields = ["react-native", "browser", "main"];
config.resolver.platforms = ["ios", "android", "native", "web"];

// Disable HMR for web to avoid version mismatch errors
if (process.env.NODE_ENV !== 'production') {
  config.server = config.server || {};
  config.server.enhanceMiddleware = (middleware, server) => {
    return (req, res, next) => {
      // Disable HMR for web platform
      if (req.url && req.url.includes('hot-reload')) {
        res.writeHead(404);
        res.end();
        return;
      }
      return middleware(req, res, next);
    };
  };
}

module.exports = config;
