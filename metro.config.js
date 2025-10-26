const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add .txt files as assets so they can be loaded with Asset.fromModule
config.resolver.assetExts.push("txt");

module.exports = config;
