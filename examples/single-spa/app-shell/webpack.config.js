const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const singleSpaDefaults = require("webpack-config-single-spa");
const { DefinePlugin } = require("webpack");

module.exports = (webpackConfigEnv, argv) => {
  const defaultConfig = singleSpaDefaults({
    orgName: "my-website",
    projectName: "app-shell",
    webpackConfigEnv,
    argv,
    disableHtmlGeneration: true,
  });

  return merge(defaultConfig, {
    devServer: {
      port: 3001,
      allowedHosts: "auto",
      https: true,
    },
    plugins: [
      new DefinePlugin({
        "process.env.DISCOVERY_ENDPOINT": JSON.stringify(
          process.env.DISCOVERY_ENDPOINT
        ),
      }),
      new HtmlWebpackPlugin({
        template: "src/index.ejs",
        inject: false,
      }),
    ],
  });
};
