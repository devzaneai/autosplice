import { CEP_Config } from "vite-cep-plugin";
import { version } from "./package.json";

const config: CEP_Config = {
  version,
  id: "com.autosplice.panel",
  displayName: "AutoSplice",
  symlink: "local",
  port: 3000,
  servePort: 5000,
  startingDebugPort: 8860,
  extensionManifestVersion: 6.0,
  requiredRuntimeVersion: 9.0,
  hosts: [
    { name: "PPRO", version: "[22.0,99.9]" },
  ],

  type: "Panel",
  iconDarkNormal: "./src/assets/light-icon.png",
  iconNormal: "./src/assets/dark-icon.png",
  iconDarkNormalRollOver: "./src/assets/light-icon.png",
  iconNormalRollOver: "./src/assets/dark-icon.png",
  parameters: ["--v=0", "--enable-nodejs", "--mixed-context"],
  width: 400,
  height: 650,

  panels: [
    {
      mainPath: "./main/index.html",
      name: "main",
      panelDisplayName: "AutoSplice",
      autoVisible: true,
      width: 400,
      height: 650,
    },
  ],
  build: {
    jsxBin: "off",
    sourceMap: true,
  },
  zxp: {
    country: "US",
    province: "CA",
    org: "AutoSplice",
    password: "autosplice-dev",
    tsa: [
      "http://timestamp.digicert.com/",
      "http://timestamp.apple.com/ts01",
    ],
    allowSkipTSA: false,
    sourceMap: false,
    jsxBin: "off",
  },
  installModules: [],
  copyAssets: ["bin"],
  copyZipAssets: [],
};
export default config;
