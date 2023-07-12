/**npm update function. @preserve Copyright(c) 2023 Allory Dante  .*/
"use strict";
var fs = require("fs");
var path = require("path");
var { EventEmitter } = require("events");
var timeout = null;
var updateInProgress = false;
var updater = new EventEmitter();
var confSets = require("config-sets");
var { spawn, spawnSync } = require("child_process");

var options = confSets.init({
  tiny_npm_updater: {
    autoupdate: true,
    logDir: "./log/tiny-npm-updater",
    current_working_directory: path.parse(process.argv[1]).dir,
    updateCheckInterval_seconds: confSets.findArg("interval") || 86400, //1 day
  },
}).tiny_npm_updater;

options.updateCheckInterval_seconds = confSets.findArg("--interval") || confSets.findArg("interval") || options.updateCheckInterval_seconds;

var cwd = path.parse(process.argv[1]).dir;

var name = "";
try {
  name = require(path.resolve(cwd, "./package.json")).name || "nameless";
} catch (err) {
  var errMsg = "Bad current_working_directory, please check config-sets.json file.";

  updater.emit("error", new Error(errMsg));
  callback("[ ERROR ] 'tiny-npm-updater' " + errMsg);
}

var logDir = path.resolve(cwd, options.logDir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
function log(info, timestamp = true) {
  if (!info) {
    return;
  }

  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
  var fileName = path.resolve(process.cwd(), options.logDir, year + "-" + month + ".log");
  var msg = "\r\n>> " + (timestamp ? "[" + date.toLocaleString("en-GB") + "] " : "") + info + "\r\n";

  fs.appendFile(fileName, msg, { flag: "a+" }, function (err) {});
  updater.emit("log", msg);
}

updater.options = options;
updater.log = log;

function updateCheckerService(packages) {
  outdated((info) => {
    let found = packages.some(function (e) {
      return info.trim().toLowerCase().includes(e);
    });

    if (!updateInProgress && found) {
      updater.emit("updateRequired");
    }

    clearTimeout(timeout);
    timeout = setTimeout(function () {
      updateCheckerService(packages);
    }, 1000 * updater.options.updateCheckInterval_seconds);
  });
}

function update(callback) {
  updateInProgress = true;

  var logText = "";

  updater.emit("update", name);

  var child = spawn("npm", ["update"], { shell: true, cwd });
  child.stdout.on("data", (data) => {
    var info = data.toString("utf-8");
    console.log(info);
    logText += info;
  });

  child.on("error", function (err) {
    logText += "error => " + err + "\r\n";
    updater.emit("error", err, name);
  });

  child.on("exit", function (code, signal) {
    var msg = "'npm update' completed\r\n";
    logText += msg;
    log(logText);
    setTimeout(function () {
      updater.emit("updated");
      updateInProgress = false;
    }, 1000);
  });
}

function outdated(callback) {
  var info = "";

  if (typeof callback === "function") {
    var isUpdated = true;
    var child = spawn("npm", ["outdated"], { shell: true, cwd });
    child.stdout.on("data", (data) => {
      info += data.toString("utf-8").trim();
      if (info) {
        info += "\r\n";
        isUpdated = false;
      }
    });

    child.on("exit", function (code, signal) {
      callback(info);
    });

    return;
  }

  var result = spawnSync("npm outdated", { shell: true, cwd });

  if (result.error) {
    throw result.error;
  }

  info += result.stdout.toString("utf-8") || "up-to-date\r\n";

  return info;
}

updater.update = update;
updater.outdated = outdated;
updater.updateCheckerService = updateCheckerService;
module.exports = updater;
