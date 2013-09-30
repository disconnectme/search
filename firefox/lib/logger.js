"use strict";

var {Cc,Ci,Cu,components} = require("chrome");
var self = require("sdk/self");
var system = require("sdk/system");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

var log_enabled = false;

exports.initialize = function(logEnabled) {
  log_enabled = logEnabled;

  deleteLog();

  this.console("Addon information");
  this.console("id = " + self.id);
  this.console("name = " + self.name);
  this.console("version = " + self.version);
  this.console("isPrivateBrowsingSupported = " + self.isPrivateBrowsingSupported);
  this.console("loadReason  = " + self.loadReason);
  this.console("System information");
  this.console(system.env.PATH); 
  this.console("platform = " + system.platform);
  this.console("architecture = " + system.architecture);
  this.console("compiler = " + system.compiler);
  this.console("build = " + system.build);
  this.console("id = " + system.id);
  this.console("name = " + system.name);
  this.console("version = " + system.version);
  this.console("vendor = " + system.vendor);
  this.console("XULRunner version = " + system.platformVersion);
  this.console("profile directory = " + system.pathFor("ProfD"));
};

exports.console = function(values) {
  if (!log_enabled) return false;

  var log = "";
  for (var i = 0; i < arguments.length; i++) {
    log += arguments[i] + ' ';
  }

  console.log(log);
  toFile(log);
};

function toFile(text){
  if (!log_enabled) return false;

  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  var fullPathToFile = getfullPathToFile();
  try{
    file.initWithPath(fullPathToFile);
    if (file.exists() === false) file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 420);

    var ostream = FileUtils.openFileOutputStream(file, FileUtils.MODE_WRONLY | FileUtils.MODE_APPEND);

    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var istream = converter.convertToInputStream(text + "\n");
    NetUtil.asyncCopy(istream, ostream, function(status) { });
  } catch (e) {
    return false;
  }
};

function getfullPathToFile() {
  var homeDir = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("Home", Ci.nsIFile);
  var saveDirectory = homeDir.path;

  var fileSeparator = "\\";  
  if (system.platform.indexOf("linu") != -1) fileSeparator = "/";

  var fileName = "searchLog.txt";
  var fullPathToFile = saveDirectory + fileSeparator + fileName;

  return fullPathToFile;
};

function deleteLog() {
  if (!log_enabled) return false;

  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  var fullPathToFile = getfullPathToFile();
  try{
    file.initWithPath(fullPathToFile);
    if (file.exists() === true) file.remove(true);
  } catch (e) {
    return false;
  }
};