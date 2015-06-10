"use strict";
const C_PROXY_SEARCH = "search.disconnect.me";
const HOUR_MS = 60 * 60 * 1000;

var self = require("sdk/self");
var {Cc, Ci, Cu, Cm, Cr, components} = require("chrome");
var tabs = require("sdk/tabs");
var pageMod = require("sdk/page-mod");
var localStorage = require("sdk/simple-storage").storage;
var {Services} = Cu.import("resource://gre/modules/Services.jsm");
var mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var iOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
var categoryManager = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
var observerService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
var windows = require("sdk/windows");
var timer = require("sdk/timers");
var xpcom = require('sdk/platform/xpcom');
var {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm");
var {Unknown, Factory} = require('sdk/platform/xpcom');
var {Class} = require('sdk/core/heritage');
var Request = require("sdk/request").Request;

var page_focus = false;
var get_user_id = function() { return localStorage['search_user_id'] };

var C_ADDRESSBAR_SEARCH = 100;
var C_FIREFOX_SEARCH    = 200;
var CURRENT_SEARCH      = C_ADDRESSBAR_SEARCH;

var contractId = "@disconnect.me/HttpRequest-Policy";
var disconnectSearch = Class({
  classDescription:   "Deferred To HTTP Requests Interceptor",
  classID:            components.ID("{CC9486AA-1E4E-4759-A976-B497268A6180}"),
  contractID:         contractId,
  _xpcom_categories:  [{category: "content-policy"}],
  QueryInterface:     XPCOMUtils.generateQI([Ci.nsIContentPolicy]),
  shouldLoad: shouldLoadFunction,
  shouldProcess: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeType, aExtra, aRequestPrincipal) {
    return Ci.nsIContentPolicy.ACCEPT;
  }
});
var factory = Factory({ contract: contractId, Component: disconnectSearch });

var httpRequestObserver = { 
  observe: function(subject, topic, data) {
    var channel = subject;
    //console.log("Got observer topic:", topic, channel);

    if (topic == "http-on-modify-request") {
      if (!(channel instanceof Ci.nsIHttpChannel)) return;
      onHttpModifyRequest(channel);
    } else if (topic == "http-on-examine-response") {
      if (!(channel instanceof Ci.nsIHttpChannel)) return;
      //onHttpExamineRespose(channel)
    }
  }
};

exports.search_initialize = function(options) {
  search_init_variables(options);
  search_load_events();

  reportUsage();
  timer.setInterval(reportUsage, HOUR_MS);
};

function search_init_variables(options) {
  var firstInstall = (options.loadReason=="install");
  if (firstInstall) {
    localStorage['new_install'] = "false";

    localStorage['chk_mode_settings'] = JSON.stringify({'omnibox':false, 'everywhere':false});
    localStorage['search_omnibox'] = "false";
    localStorage['search_everywhere'] = "false";

    localStorage['search_engines'] = "0"; // google
    localStorage['mode_settings'] = "0";  // popup only
    localStorage['search_cohort'] = "4";

    localStorage['search_omnibox_on'] = localStorage['search_omnibox_off'] = "0";
    localStorage['search_everywhere_on'] = localStorage['search_everywhere_off'] = "0";
    localStorage['search_total'] = "0";

    localStorage['build_version'] = self.version;
    localStorage['search_group'] = 'disconnect';
    localStorage['search_product'] = 'websearch';
    localStorage['search_user_id'] = "0";

    var historyService = Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService);
    var query1 = historyService.getNewQuery();
    query1.searchTerms = "search/partner/";
    query1.domain = "disconnect.me";
    query1.beginTimeReference = query1.TIME_RELATIVE_NOW;
    query1.beginTime = -24 * 60 * 60 * 1000000 * 7; // 1 week ago in microseconds
    query1.endTimeReference = query1.TIME_RELATIVE_NOW;
    query1.endTime = 0; // now
    var historyOptions = historyService.getNewQueryOptions();
    var result = historyService.executeQueries([query1], 1, historyOptions);

    var cont = result.root;
    cont.containerOpen = true;
    var partner = false;
    for (var i = 0; i < cont.childCount; i ++) {
      var node = cont.getChild(i);
      var url = node.uri;
      partner = url.substr(url.lastIndexOf('/') + 1);
      //dump("\n" + partner + "\n");
    }
    cont.containerOpen = false;
    if (partner) {
      tabs.open('https://disconnect.me/search/partner/' + partner + '/welcome');
      localStorage['partner'] = partner;
    }
    else {
      tabs.open('https://disconnect.me/search/welcome');
    }
  }

  return firstInstall;
};

function search_load_events() {
  categoryManager.addCategoryEntry("content-policy", "http-request", contractId, false, true);
  if (xpcom.isRegistered(factory)) xpcom.unregister(factory);
  xpcom.register(factory);

  //observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);
  observerService.addObserver(httpRequestObserver, "http-on-modify-request", false);
  windows.browserWindows.on('open', onWindowOpen);

  onWindowOpen(); // load events in current window
  pageMod.PageMod({
    include: [/.*google.*/, /.*bing.*/, /.*yahoo.*/, /.*duckduckgo.*/],
    contentScriptFile: self.data.url("scripts/serp.js"),
    contentScriptWhen: "ready"
  });
};

function deserialize(object) {
  return (typeof object == 'string') ? JSON.parse(object) : object;
};

function getMostRecentWindow() {
  return mediator.getMostRecentWindow('navigator:browser');
};

function getBrowserFromChannel(aChannel) {
  try {
    var notificationCallbacks = aChannel.notificationCallbacks ? aChannel.notificationCallbacks : aChannel.loadGroup.notificationCallbacks;
    if (!notificationCallbacks) return null;

    var domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
    return getMostRecentWindow().gBrowser.getBrowserForDocument(domWin.top.document);
  } catch (e) {
    return null;
  }
};

function getDocumentFromChannel(aChannel) {
  try {
    var notificationCallbacks = aChannel.notificationCallbacks ? aChannel.notificationCallbacks : aChannel.loadGroup.notificationCallbacks;
    if (!notificationCallbacks) return null;

    return notificationCallbacks.getInterface(Ci.nsIDOMWindow).top.document;
  } catch (e) {
    return null;
  }
};

function redirectTo(aChannel, aURI) {
  //console.log("redirectTo:", aURI.spec);

  if ("redirectTo" in aChannel) {
    try {
      aChannel.redirectTo(aURI);
      return true;
    } catch(e) {
      //console.log("Exception on nsIHttpChannel.redirectTo: ", e);
    }
  } else {
    aChannel.cancel(Cr.NS_BINDING_ABORTED);
    getBrowserFromChannel(aChannel).loadURI(aURI.spec, null, null);
    return true;
  }

  return false;
};

function shouldLoadFunction(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeTypeGuess, aExtra, aRequestPrincipal) {
  try {
    const T_MAIN_FRAME = (aContentType == Ci.nsIContentPolicy.TYPE_DOCUMENT);
    const T_OTHER = (aContentType == Ci.nsIContentPolicy.TYPE_OTHER);
    const T_SCRIPT = (aContentType == Ci.nsIContentPolicy.TYPE_SCRIPT);
    const T_XMLHTTPREQUEST = (aContentType == Ci.nsIContentPolicy.TYPE_XMLHTTPREQUEST);

    const REQUESTED_URL = aContentLocation.spec;    
    const CHILD_DOMAIN = aContentLocation.host;

    //if (T_MAIN_FRAME) console.log("shouldLoad: ", REQUESTED_URL, aContentType);

    var modeSettings = deserialize(localStorage['mode_settings']);

    var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
    var isBing = (CHILD_DOMAIN.search("bing.") > -1);
    var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
    var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
    var hasSearch = (REQUESTED_URL.search("/search") > -1);
    var hasMaps = (REQUESTED_URL.search("/maps") > -1);
    var hasGoogleImgApi = (REQUESTED_URL.search("tbm=isch") > -1);

    var isOmniboxSearch = (page_focus == false);
    var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
    var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
    var isProxied = ( 
      (modeSettings == 0 && isSearchByPopUp) ||
      (modeSettings == 1 && (isSearchByPopUp || isOmniboxSearch) ) ||
      (modeSettings == 2 && (isSearchByPopUp || isSearchByPage ) ) ||
      (modeSettings == 3 && (isSearchByPopUp || isOmniboxSearch || !isOmniboxSearch || isSearchByPage ) )
    );

    // blocking autocomplete by OminiBox or by Site URL
    var isChromeInstant = ( isGoogle && T_MAIN_FRAME && (REQUESTED_URL.search("chrome-instant") > -1) );
    var isGoogleOMBSearch = ( isGoogle && T_OTHER && (REQUESTED_URL.search("/complete/") > -1) );
    var hasGoogleReviewDialog = (REQUESTED_URL.search("reviewDialog") > -1);
    var isGoogleSiteSearch = (!T_MAIN_FRAME && isGoogle && !hasGoogleImgApi && !hasGoogleReviewDialog &&
      ((REQUESTED_URL.search("suggest=") > -1) || (REQUESTED_URL.indexOf("output=search") > -1) || (REQUESTED_URL.indexOf("/s?") > -1) ||
      (REQUESTED_URL.search("/complete/search") > -1) || (REQUESTED_URL.search("/search") > -1)));
    var isBingOMBSearch = ( isBing && T_OTHER && (REQUESTED_URL.search("osjson.aspx") > -1) );
    var isBingSiteSearch = ( isBing && T_SCRIPT && (REQUESTED_URL.search("qsonhs.aspx") > -1) );
    var isYahooSearch = ( isYahoo && T_SCRIPT && (REQUESTED_URL.search("search.yahoo") > -1) && ((REQUESTED_URL.search("jsonp") > -1) || (REQUESTED_URL.search("gossip") > -1)) );
    var isNotGoogleMapSearch = !(REQUESTED_URL.search("tbm=map") > -1);
    
    if ( (isProxied && (isChromeInstant || isGoogleOMBSearch || (isGoogleSiteSearch && isNotGoogleMapSearch) || isBingOMBSearch || isBingSiteSearch || isYahooSearch)) || 
      (modeSettings==2||modeSettings==3) && (isBingOMBSearch || isBingSiteSearch || isYahooSearch) ) {
      //console.log("BLOCKING REQUEST", REQUESTED_URL);
      return Ci.nsIContentPolicy.REJECT;
    }

    return Ci.nsIContentPolicy.ACCEPT;
  } catch (e) {
    //console.log("shouldLoad Exception:", e);
    return Ci.nsIContentPolicy.ACCEPT;
  }
};

function onHttpModifyRequest(channel) {
  try {
    const PARENT = ((channel.loadFlags & Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) > 0);
    const REQUESTED_URL = channel.URI.spec;
    const CHILD_DOMAIN = channel.URI.host;
    const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
    const REGEX_URL_YAHOO = /[?|&]p=(.+?)(&|$)/;
    
    var C_EXTENSION_PARAMETER = "&source=extension&extension=firefox"

    //if (PARENT) console.log("Http-on-Modify-Request:", REQUESTED_URL, PARENT);
    onWebRequestBeforeSendHeaders(channel);

    var modeSettings = deserialize(localStorage['mode_settings']);

    var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
    var isBing = (CHILD_DOMAIN.search("bing.") > -1);
    var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
    var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1) && (REQUESTED_URL.search("/html") == -1) ; // /html indicate that the server made a redirect
    var hasSearch = (REQUESTED_URL.search("/search") > -1);
    var hasMaps = (REQUESTED_URL.search("/maps") > -1);
    var hasGoogleImgApi = (REQUESTED_URL.search("tbm=isch") > -1);
    
    if (localStorage.search_engines == 3 || isDuckDuckGo || (REQUESTED_URL.search("ses=DuckDuckGo") != -1) )  C_EXTENSION_PARAMETER = ""; //if is duckduck no proxy is need on server

    var isOmniboxSearch = (page_focus == false);
    var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
    var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
    var isProxied = ( 
      (modeSettings == 0 && isSearchByPopUp) ||
      (modeSettings == 1 && (isSearchByPopUp || isOmniboxSearch) ) ||
      (modeSettings == 2 && (isSearchByPopUp || isSearchByPage ) ) ||
      (modeSettings == 3 && (isSearchByPopUp || isOmniboxSearch || !isOmniboxSearch || isSearchByPage ) )
    );

    var isWebSearch = (REQUESTED_URL.search(C_PROXY_SEARCH + "/searchTerms/search?") > -1);
    var hasNotParametersExtension = (REQUESTED_URL.search(C_EXTENSION_PARAMETER) == -1);

    // Redirect URL -> Proxied
    var match = REGEX_URL.exec(REQUESTED_URL);
    if (isYahoo) match = REGEX_URL_YAHOO.exec(REQUESTED_URL);

    var foundQuery = ((match != null) && (match.length > 1));
    var URLToProxy = ((isGoogle && (hasSearch || hasMaps)) || (isBing && hasSearch) || (isYahoo && hasSearch) || isDuckDuckGo);
    
    if (isProxied && PARENT && URLToProxy && foundQuery) { 
      //console.log("Search by OminiBox/Everywhere");
      localStorage.search_total = parseInt(localStorage.search_total) + 1;

      var firefoxSearch = (CURRENT_SEARCH == C_FIREFOX_SEARCH);
      var searchEngineIndex = deserialize(localStorage['search_engines']);
      var searchEngineName = null;
      if      ( (searchEngineIndex == 0 && !isSearchByPage && !firefoxSearch) || (isGoogle && isSearchByPage) || (isGoogle && firefoxSearch) ) searchEngineName = 'Google';
      else if ( (searchEngineIndex == 1 && !isSearchByPage && !firefoxSearch) || (isBing && isSearchByPage) || (isBing && firefoxSearch) ) searchEngineName = 'Bing';
      else if ( (searchEngineIndex == 2 && !isSearchByPage && !firefoxSearch) || (isYahoo && isSearchByPage) || (isYahoo && firefoxSearch) ) searchEngineName = 'Yahoo';
      else if ( (searchEngineIndex == 3 && !isSearchByPage && !firefoxSearch) || (isDuckDuckGo && isSearchByPage) || (isDuckDuckGo && firefoxSearch) ) searchEngineName = 'DuckDuckGo';
      else searchEngineName = 'google';

      var url_redirect = 'https://' + C_PROXY_SEARCH + '/searchTerms/search?query=' + match[1] + C_EXTENSION_PARAMETER + '&ses=' + searchEngineName;
      var uri = iOService.newURI(url_redirect, "UTF-8", null);
      redirectTo(channel, uri);
    } else if (isWebSearch && hasNotParametersExtension) {
      //search from websearch page, add parameters(if they aren't there yet) to indicate that extension is already installed.
      var url_redirect = REQUESTED_URL + C_EXTENSION_PARAMETER;
      var uri = iOService.newURI(url_redirect, "UTF-8", null);
      redirectTo(channel, uri);
    } else if (!PARENT && modeSettings>=2 && /jQuery?/.test(REQUESTED_URL)) {
      //console.log("FOUND BLEKKO HACK", REQUESTED_URL);
      var dcm = getDocumentFromChannel(channel);
      if (dcm) {
        var jsCode = "window.location = '" + REQUESTED_URL + '&search_plus_one=form'+ "';";
        var script = dcm.createElement('script');
        script.innerHTML = jsCode;
        dcm.body.appendChild(script);
      }
    }
  } catch(e) {
    //console.log("Http-on-Modify-Request Exception:", e, channel.URI.spec);
  }
};

function onWebRequestBeforeSendHeaders(channel) {
  const REQUESTED_URL = channel.URI.spec;
  try {
    if (REQUESTED_URL.indexOf(C_PROXY_SEARCH) >= 0) {
      var XDST = {name: 'X-Disconnect-Stats', value: JSON.stringify({
        group_id: localStorage.search_group,
        product_id: localStorage.search_product,
        user_id: get_user_id()
      })};
      channel.setRequestHeader(XDST.name, XDST.value, false);
    }
  } catch(e) {
    //console.log("onWebRequestBeforeSendHeaders Exception:", e, channel.URI.spec);
  }
};

function onWindowOpen() {
  var window = getMostRecentWindow();
  var content = window.document.getElementById('content');
  var searchbar = window.document.getElementById('searchbar');
  var urlbar = window.document.getElementById('urlbar');

  var pageFocus = function() {
    page_focus = true;
    //console.log("PAGE FOCUS:", page_focus);
  };

  var urlBarFocus = function() {
    CURRENT_SEARCH = C_ADDRESSBAR_SEARCH;
    page_focus = false;
    //console.log("FOCUS URLBAR:", page_focus, C_ADDRESSBAR_SEARCH);
  };

  var searchBarFocus = function() {
    CURRENT_SEARCH = C_FIREFOX_SEARCH;
    page_focus = false;
    var modeSettings = deserialize(localStorage['mode_settings']);
    if (modeSettings == 1 || modeSettings == 3) { // private omnibox
      var CHILD_DOMAIN = Services.search.defaultEngine.searchForm;
      var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
      var isBing = (CHILD_DOMAIN.search("bing.") > -1);
      var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
      var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
      if (isGoogle || isBing || isYahoo || isDuckDuckGo) {
        //console.log("SUGGEST BLOCK");
        Services.prefs.setBoolPref("browser.search.suggest.enabled", false);
      } else {
        Services.prefs.setBoolPref("browser.search.suggest.enabled", true);
      }
    } else {
      Services.prefs.setBoolPref("browser.search.suggest.enabled", true);
    }
    //console.log("FOCUS SEARCHBAR:", page_focus, CURRENT_SEARCH);
  };

  if (content)   content.addEventListener('keypress', pageFocus);
  if (content)   content.addEventListener('click', pageFocus);
  if (urlbar)    urlbar.addEventListener('focus', urlBarFocus);
  if (searchbar) searchbar.addEventListener('focus', searchBarFocus);
};

function reportUsage() {
  const oneDayAsMsec = 24 * HOUR_MS;

  var now = new Date();
  var firstPing   = new Date(localStorage.search_first_ping || now.getTime());
  var firstUpdate = (firstPing.getTime() == now.getTime());

  var dailyPing      = new Date(localStorage.search_daily_ping || now.getTime());
  var weeklyPing     = new Date(localStorage.search_weekly_ping || now.getTime());
  var monthlyPing    = new Date(localStorage.search_monthly_ping || now.getTime());
  var quarterlyPing  = new Date(localStorage.search_quarterly_ping || now.getTime());
  var semiannualPing = new Date(localStorage.search_semiannual_ping || now.getTime());
  var yearlyPing     = new Date(localStorage.search_yearly_ping || now.getTime());

  var daily      = ((now.getTime() - dailyPing.getTime()) >= oneDayAsMsec);
  var weekly     = ((now.getTime() - weeklyPing.getTime()) >= 7*oneDayAsMsec);
  var monthly    = ((now.getTime() - monthlyPing.getTime()) >= 30*oneDayAsMsec);
  var quarterly  = ((now.getTime() - quarterlyPing.getTime()) >= 90*oneDayAsMsec);
  var semiannual = ((now.getTime() - semiannualPing.getTime()) >= 180*oneDayAsMsec);
  var yearly     = ((now.getTime() - yearlyPing.getTime()) >= 365*oneDayAsMsec);

  //yearly|semiannual|quarterly|monthly|weekly|daily
  var report_update_type;
  if      (yearly)     report_update_type = 0x20 | 0x10 | 0x08 | 0x04 | 0x01;
  else if (semiannual) report_update_type = 0x10 | 0x08 | 0x04 | 0x01;
  else if (quarterly)  report_update_type = 0x08 | 0x04 | 0x01;
  else if (monthly)    report_update_type = 0x04 | 0x01;
  else if (weekly)     report_update_type = 0x02 | 0x01;
  else if (daily)      report_update_type = 0x01;
  else                 report_update_type = 0x00; 

  var data = {
    conn: 'https://hits.disconnect.me',
    password: 'dirthavepure',
    time: new Date().toUTCString(),
    path: '/partnership_analytics.json?',
    ua: getMostRecentWindow().navigator.userAgent,
    host: 'disconnect.me',
    method: 'POST',
    status: 200
  };
  data.path = data.path + [
    'group_id=' + localStorage.search_group,
    'product_id=' + localStorage.search_product,  
    'user_id=' + get_user_id(),
    'build=' + localStorage.build_version,
    'cohort=' + localStorage.search_cohort
  ].join('&');

  var report_values_to_send = {
    first_update: firstUpdate || false,
    search_engine: localStorage.search_engines || 0,
    omnibox: localStorage.search_omnibox || false,
    everywhere: localStorage.search_everywhere || false,
    omnibox_on: localStorage.search_omnibox_on || 0,
    omnibox_off: localStorage.search_omnibox_off || 0,
    everywhere_on: localStorage.search_everywhere_on || 0,
    everywhere_off: localStorage.search_everywhere_off || 0,
    searches_total: localStorage.search_total || 0
  }
  data.path = data.path + '&' + [
    'first_update=' + firstUpdate.toString(),
    'updated_type=' + report_update_type.toString(),
    'search_engine=' + report_values_to_send.search_engine.toString(),
    'omnibox=' + report_values_to_send.omnibox.toString(),
    'everywhere=' + report_values_to_send.everywhere.toString(),
    'omnibox_on=' + report_values_to_send.omnibox_on.toString(),
    'omnibox_off=' + report_values_to_send.omnibox_off.toString(),
    'everywhere_on=' + report_values_to_send.everywhere_on.toString(),
    'everywhere_off=' + report_values_to_send.everywhere_off.toString(),
    'searches_total=' + report_values_to_send.searches_total.toString()
  ].join('&');

  Request({
    url: data.conn,
    content: data,
    onComplete: function (response) {
      if (firstUpdate)               localStorage.search_first_ping      = now.getTime();
      if (daily || firstUpdate)      localStorage.search_daily_ping      = now.getTime();
      if (weekly || firstUpdate)     localStorage.search_weekly_ping     = now.getTime();
      if (monthly || firstUpdate)    localStorage.search_monthly_ping    = now.getTime();
      if (quarterly || firstUpdate)  localStorage.search_quarterly_ping  = now.getTime();
      if (semiannual || firstUpdate) localStorage.search_semiannual_ping = now.getTime();
      if (yearly || firstUpdate)     localStorage.search_yearly_ping     = now.getTime();
      localStorage.search_omnibox_on = parseInt(localStorage.search_omnibox_on) - report_values_to_send.omnibox_on;
      localStorage.search_omnibox_off = parseInt(localStorage.search_omnibox_off) - report_values_to_send.omnibox_off;
      localStorage.search_everywhere_on = parseInt(localStorage.search_everywhere_on) - report_values_to_send.everywhere_on;
      localStorage.search_everywhere_off = parseInt(localStorage.search_everywhere_off) - report_values_to_send.everywhere_off;
      localStorage.search_total = parseInt(localStorage.search_total) - report_values_to_send.searches_total;
      //console.log(response.text);
    }
  }).post();
};