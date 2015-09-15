"use strict";

var self = require("sdk/self");
var panel = require("sdk/panel");
var tabs = require("sdk/tabs");
var windows = require("sdk/windows");
var pageMod = require("sdk/page-mod");
var localStorage = require("sdk/simple-storage").storage;
var tgButton = require('sdk/ui/button/toggle');
var privateBrowsing = require("sdk/private-browsing");
var BG = require("./background.js");

var searchPanel = panel.Panel({
  width: 280,
  height: 284,
  contentURL: self.data.url("markup/popup.html"),
  contentScriptFile: [
    self.data.url("scripts/vendor/jquery/jquery.js"),
    self.data.url("scripts/popup.js")
  ],
  onHide: handleHide
});

var searchButton = tgButton.ToggleButton({
  id: "disconnect-search",
  label: "Disconnect Search",
  tooltiptext: "Disconnect Search",
  icon: {
    "16": "./images/16.png",
    "32": "./images/48.png",
    "64": "./images/128.png"
  },
  onChange: handleChange
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

pageMod.PageMod({
  include: [/.*search.disconnect.me.*/, /.*searchbeta.disconnect.me.*/],
  contentScriptFile: self.data.url("scripts/incognito.js"),
  contentScriptWhen: "ready",
  onAttach: function(worker) {
    worker.port.on("open_result", function(request) {
      var incognito = localStorage["incognito"] == "true";
      if (incognito && request.type == "new_window") {
        tabs.open({url: request.url, inNewWindow: true, isPrivate: true});
      } else if (request.type == "new_tab") {
        tabs.open({url: request.url, inBackground: true});
      } else {
        windows.browserWindows.activeWindow.tabs.activeTab.url = request.url;
      }
    });
  }
});

pageMod.PageMod({
    include: "https://duckduckgo.com/html*",
    contentScriptFile: [self.data.url("scripts/vendor/jquery/jquery.js"), self.data.url("scripts/ddgwarn.js")] ,
    contentStyleFile:  self.data.url("stylesheets/ddgwarn.css"),
    contentScriptWhen: "ready"
});

function handleChange(state) {
  if (state.checked) {
    searchPanel.show({position: searchButton});
  }
};

function handleHide() {
  searchButton.state('window', {checked: false});
};

exports.main = function(options, callbacks) {
  BG.search_initialize(options);
};