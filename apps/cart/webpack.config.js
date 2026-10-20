const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;
module.exports = {
  entry: "./src/index.ts",
  devtool: "source-map",
  output: {
    publicPath: "auto",
    uniqueName: "cart",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@mfe/cart-client": path.resolve(__dirname, "../../packages/cart-client/src/index.ts"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: { transpileOnly: true },
      },
      {
        test: /\.module\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                namedExport: false,
                exportLocalsConvention: "as-is",
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "cart",
      filename: "remoteEntry.js",
      exposes: { "./CartApp": "./src/CartApp" },
      shared: {
        react: { singleton: true, requiredVersion: "18.3.1" },
        "react-dom": { singleton: true, requiredVersion: "18.3.1" },
        "react-router-dom": { singleton: true, requiredVersion: "6.28.1" },
      },
    }),
    new HtmlWebpackPlugin({ template: "./src/index.html" }),
  ],
  devServer: {
    port: 3002,
    hot: true,
    historyApiFallback: true,
    static: false,
    headers: { "Access-Control-Allow-Origin": "*" },
  },
};
