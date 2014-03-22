"use strict";

var self = require("sdk/self");
var panel = require("sdk/panel");
var tabs = require("sdk/tabs");
var windows = require("sdk/windows");
var localStorage = require("sdk/simple-storage").storage;
var toolbarbutton = require("toolbar/toolbarbutton");
var privateBrowsing = require("sdk/private-browsing");
var BG = require("background.js");

var searchPanel = panel.Panel({
  width: 280,
  height: 247,
  contentURL: self.data.url("markup/popup.html"),
  contentScriptFile: [
    self.data.url("scripts/vendor/jquery/jquery.js"),
    self.data.url("scripts/popup.js")
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
  searchPanel.port.emit("show", localStorage);
});

searchPanel.port.on("setLocalStorage", function setLocalStorage(key, value) {
 localStorage[key] = value;
});

searchPanel.port.on("createTab", function(url) {
  searchPanel.hide();
  
  if (url.indexOf("mailto:")>=0) {
    windows.browserWindows.activeWindow.tabs.activeTab.url = url;
  } else {
    var isPrivateBrowsing = privateBrowsing.isPrivate(windows.browserWindows.activeWindow);
    var objTab = { url: url, isPrivate: isPrivateBrowsing };
    tabs.open(objTab);
  }
});

exports.main = function(options, callbacks) {
  // On install moves button into the toolbar
  if (options.loadReason == "install") {
    searchButton.moveTo({
      toolbarID: "nav-bar",
      forceMove: false
    });
  }

  BG.search_initialize(options);
};