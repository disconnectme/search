"use strict";

var {Cc, Ci} = require("chrome");
var widgets = require("sdk/widget");
var panel = require("sdk/panel");
var tabs = require("sdk/tabs"); 
var localStorage = require("sdk/simple-storage").storage; 
var toolbarbutton = require("toolbar/toolbarbutton");
var Request = require("sdk/request").Request;
var timer = require("sdk/timers");
var self = require("sdk/self");
var windows = require("sdk/windows");
var logger = require("./logger");
var DMSP1 = require("search-plus-one.js");

var searchPanel = panel.Panel({
  width: 280,
  height: 215,
  contentURL: self.data.url("markup/standalone.html"),
  contentScriptFile: [
    self.data.url("scripts/vendor/jquery/jquery.js"),
    self.data.url("scripts/standalone.js")
  ]
});

var searchButton = toolbarbutton.ToolbarButton({
  id: "disconnect-search",
  label: "Disconnect Search",
  tooltiptext: "Disconnect Search",
  image: self.data.url("images/16.png"),
  panel: searchPanel,
  onCommand: function() { }
});
 
searchPanel.on("show", function() {
  searchPanel.port.emit("show", localStorage['chk_mode_settings'],localStorage['search_engines']);
});

searchPanel.port.on("hidePanel", function() {
  searchPanel.hide();
});

searchPanel.port.on("createTab", function createTab(url) {
  searchPanel.hide();
  tabs.open(url);
});

searchPanel.port.on("email", function createTab(url) {
  searchPanel.hide();
  windows.browserWindows.activeWindow.tabs.activeTab.url = url;
});


searchPanel.port.on("setLocalStorage", function setLocalStorage(key, value) {
 localStorage[key] = value;
});

searchPanel.port.on("getLocalStorage", function getLocalStorage(key) {
  searchPanel.port.emit("handleLocalStorage", localStorage);
});

// Load
exports.main = function(options, callbacks) {
  // On install moves button into the toolbar
  if (options.loadReason == "install") {
    searchButton.moveTo({
      toolbarID: "nav-bar",
      forceMove: false
    });
  }

  // define variables
  if (options.loadReason == "install") {
    var chk_box = {'ominibox': true, 'everywhere': false, 'secure': false};

    localStorage['search_engines'] = "0";
    localStorage['mode_settings'] = "1";
    localStorage['chk_mode_settings'] = JSON.stringify(chk_box);

    localStorage['secure_reminder_show'] = "false";  // open dialog
    localStorage['secure_search'] = "false";         // hyper secure
    localStorage['coverage_plus_one_two'] = "false"; // coverage +1 & +2

    localStorage['omnibox'] = "true";  // private search in ominibox
    localStorage['everywhere'] = "false"; // private search everywhere
    localStorage['versionInstaled'] = self.version;
     var reqNewInstal = Request({ url: "http://goldenticket.disconnect.me/search"});
     reqNewInstal.get();
  }

  DMSP1.loadListeners(this);

  // welcome pages
  if (options.loadReason == "install") {
    tabs.open('https://www.disconnect.me/search/intro');
  } else if (options.loadReason == "upgrade" || options.loadReason == "downgrade") {
    tabs.open('https://www.disconnect.me/search/intro');
  }
};

exports.onUnload = function(reason) {
  if (reason == 'disable' || reason == 'uninstall' || reason == 'shutdown') {
    DMSP1.removeProxyUnload();
  }

  DMSP1.restoreOriginalPrefs();
};

/* Submits stats every 24 hours. */
function reportUsage() {
  // Ensure we have valid dates.
  var now = new Date();
  var firstPing = new Date(localStorage['firstPing'] || now);
  var lastPing = new Date(localStorage['lastPing'] || now);

  const howLongInstalledMsec = now.getTime() - firstPing.getTime();
  const url = '';
  const oneDayAsMsec = 24 * 60 * 60 * 1000;

  // At least 24 hours between reports.
  if (now.getTime() - lastPing.getTime() >= oneDayAsMsec || (firstPing.getTime() == now.getTime())) {
    // Set post params
    const params = {
      daily: JSON.stringify(howLongInstalledMsec >= oneDayAsMsec),
      weekly: JSON.stringify(howLongInstalledMsec >= 7 * oneDayAsMsec),
      monthly: JSON.stringify(howLongInstalledMsec >= 30 * oneDayAsMsec),
      version: localStorage['versionInstaled'] || "< 0.0.7.1",
      searches_since_last_ping: localStorage['searches_since_last_ping'] || "-1",
      searches_total: localStorage['searches_total'] || "0",
      search_engine: localStorage['search_engines'] || "Default",
      omnibox: localStorage['omnibox'] || "false",
      everywhere: localStorage['everywhere'] || "false"
    }
    
    logger.console("Report Usage: " + JSON.stringify(params));
    
    var reqReport = Request({
        url: "https://services.disconnect.me/search_ping",
        content: params,
        overrideMimeType: "text/plain;",
        onComplete: function (response) {
          var now = new Date();
          localStorage['searches_since_last_ping'] = JSON.stringify(0);
          localStorage['lastPing'] = now;
          if (localStorage['firstPing'] == null) {
            localStorage['firstPing'] = now;
          }
        }
      });

      reqReport.post();
  }
};

// Try to run report every hour - it will only run every 24 hours.
timer.setInterval(reportUsage, 60 * 60 * 1000);
// Post anonymous usage data to server on startup.
reportUsage();