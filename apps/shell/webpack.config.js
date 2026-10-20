const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = require("webpack").container;
/** Host. Remotes are URLs fetched at runtime — this build does not compile catalog or cart source. */
module.exports = {
  entry: "./src/index.ts",
  devtool: "source-map",
  output: {
    publicPath: "auto",
    uniqueName: "shell",
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
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "shell",
      remotes: {
        catalog: "catalog@http://localhost:3001/remoteEntry.js",
        cart: "cart@http://localhost:3002/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: "18.3.1" },
        "react-dom": { singleton: true, requiredVersion: "18.3.1" },
        "react-router-dom": { singleton: true, requiredVersion: "6.28.1" },
      },
    }),
    new HtmlWebpackPlugin({ template: "./src/index.html" }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    static: false,
    headers: { "Access-Control-Allow-Origin": "*" },
    client: {
      overlay: {
        errors: true,
        runtimeErrors: false,
      },
    },
  },
};
