"use strict";

/** Search Plus One **/
var data = require("sdk/self").data;
var {Cc, Ci, Cu, Cm, Cr, components} = require("chrome");
var tabs = require("sdk/tabs");
var tabUtils = require('sdk/tabs/utils');
var events = require("sdk/system/events");
var pageMod = require("sdk/page-mod");
var localStorage = require("sdk/simple-storage").storage;
var {Services} = Cu.import("resource://gre/modules/Services.jsm");
var mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var iOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
var categoryManager = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
var observerService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
var windows = require("sdk/windows");

var xpcom = require('sdk/platform/xpcom');
var {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm");
var {Unknown, Factory} = require('sdk/platform/xpcom');
var {Class} = require('sdk/core/heritage');
var Request = require("sdk/request").Request;
var logger = require("./logger");

/* BEGIN - Variables */
this.proxy_tabs = [];

this.C_PROXY_INVISIBLE = "invisible.disconnect.me";
this.C_PROXY_PRESETTING = "search.disconnect.me/presetting";
this.C_PROXY_REDIRECT = "disconnect.me/search";
this.C_PROXY_SEARCH = "search.disconnect.me";

this.C_MN = "d2hhdGlmaWRpZHRoaXMx";
this.C_DISCONNECT_ID = '_disconnectID';
this.C_SEARCH_REQUEST = 7;
this.C_HISTORY_REQUEST = 700;

this.C_OMNIBOX_SEARCH = 100;
this.C_FIREFOX_SEARCH = 200;

this.config_proxied = {
  host: C_PROXY_INVISIBLE,
  port: 3000
};

this.disconnectID = 0;
this.requestID = 0;
this.last_tab_actived = 0;
this.current_search = 0;

this.XDHR = {name: 'X-Disconnect-Auth', value: 'none'};
this.channelRedirect = true;
this.enablePresetting = false;
this.iconChange = this.logEnabled = this.sendXDIHR = false;
/* END - Variables */


/* Destringifies an object. */
function deserialize(object) {
  return (typeof object == 'string') ? JSON.parse(object) : object;
};


var historyObserver = {
  OnHistoryGoBack: function(backURI) {
    return historyGoForwardIndex("OnHistoryGoBack", backURI);
  },
  OnHistoryGoForward: function(forwardURI) {
    return historyGoForwardIndex("OnHistoryGoForward", forwardURI);
  },
  OnHistoryGotoIndex: function(index, gotoURI) {
    return historyGoForwardIndex("OnHistoryGotoIndex: ", gotoURI);
  },
  OnHistoryNewEntry: function(newURI) {
    //logger.console("OnHistoryNewEntry");
    return true;
  },
  OnHistoryPurge: function(numEntries) {
    //logger.console("OnHistoryPurge");
    return true;
  },
  OnHistoryReload: function(reloadURI, reloadFlags) {
    //logger.console("OnHistoryReload");
    return true;
  },
  QueryInterface: function(aIID) {
    if ( aIID.equals(Ci.nsISHistoryListener) || aIID.equals(Ci.nsISupportsWeakReference) || aIID.equals(Ci.nsISupports) ) {
      return this;
    }
    throw Cr.NS_ERROR_NO_INTERFACE;
  },
  GetWeakReference: function() {
    return Cc["@mozilla.org/appshell/appShellService;1"].createInstance(Ci.nsIWeakReference);
  }
};

function historyGoForwardIndex(eventName, URI) {
  var coveragePlusOneTwo = (deserialize(localStorage['coverage_plus_one_two']) == true);
  var currentTabActived = getCurrentTabActived();
  var tabId = currentTabActived._disconnectID;
  var url = URI.spec;

  logger.console(eventName, URI.spec, currentTabActived._disconnectID, isProxyUrl(url));
  logger.console(JSON.stringify(proxy_tabs));

  var found = false;
  var tabObj = proxy_tabs[tabId];
  if (tabObj) {
    tabObj.request_type = C_HISTORY_REQUEST;
    tabObj.current_page = url;

    tabObj.search.available = true;
    tabObj.plus_one.available = coveragePlusOneTwo;
    tabObj.plus_two.available = coveragePlusOneTwo;
    if (tabObj.search.url == formatUrl(url) || isProxyUrl(url)) {
      tabObj.search.available = false;
      found = true;
    } else if (tabObj.plus_one.url == formatUrl(url)) {
      tabObj.search.available = false;
      tabObj.plus_one.available = false;
      found = true;
    } else if (tabObj.plus_two.url == formatUrl(url)) {
      tabObj.search.available = false;
      tabObj.plus_one.available = false;
      tabObj.plus_two.available = false;
      found = true;
    }
  }

  if (found)
    setProxy();
  else
    removeProxy();

  logger.console(JSON.stringify(proxy_tabs));
  return true;
};

function formatUrl(URL) {
  var newUrl = URL.split("#");
  var value = (newUrl.length > 0) ? newUrl[0] : URL;
  //logger.console("formatUrl:", value);
  return value;
};

// Define a component
var contractId = "@disconnect.me/HttpRequest-Policy"
var disconnectSearch = Class({
  classDescription:   "Deferred To HTTP Requests Interceptor",
  classID:            components.ID("{CC9486AA-1E4E-4759-A976-B497268A6180}"),
  contractID:         contractId,
  _xpcom_categories:  [{category: "content-policy"}],
  QueryInterface:     XPCOMUtils.generateQI([Ci.nsIContentPolicy]),

  shouldLoad: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeTypeGuess, aExtra, aRequestPrincipal) {
    try {
      var REQUESTED_URL = aContentLocation.spec;    
      var CHILD_DOMAIN = aContentLocation.host;

      // Search proxied
      const T_MAIN_FRAME = (aContentType == Ci.nsIContentPolicy.TYPE_DOCUMENT);
      const T_OTHER = (aContentType == Ci.nsIContentPolicy.TYPE_OTHER);
      const T_SCRIPT = (aContentType == Ci.nsIContentPolicy.TYPE_SCRIPT);
      const T_XMLHTTPREQUEST = (aContentType == Ci.nsIContentPolicy.TYPE_XMLHTTPREQUEST);

      //logger.console("shouldLoad: ", REQUESTED_URL, aContentType);
      if (T_MAIN_FRAME) logger.console("shouldLoad: ", REQUESTED_URL, aContentType);

      var modeSettings = deserialize(localStorage['mode_settings']);
      var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
      var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
      var isProxied = ( ((modeSettings == 0) && isSearchByPopUp) || ((modeSettings == 1) && !isSearchByPage) || (modeSettings >= 2) );
      //logger.console(" modeSettings: " + modeSettings + " byPage: " + isSearchByPage + " byPopup: " + isSearchByPopUp + " isProxie: " + isProxied);

      var isDisconnect = (REQUESTED_URL.indexOf(C_PROXY_SEARCH) >= 0);
      var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
      var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1);
      var isBing = (CHILD_DOMAIN.search("bing.") > -1);
      var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
      var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
      var isChromeInstant = ( isGoogle && T_MAIN_FRAME && (REQUESTED_URL.search("chrome-instant") > -1) );
      var isGoogleOMBSearch = ( isGoogle && T_OTHER && (REQUESTED_URL.search("/complete/") > -1) );
      var hasGoogleImgApi = (REQUESTED_URL.search("tbm=isch") > -1);
      var isGoogleSiteSearch = ( (isGoogle || isDisconnect) && T_XMLHTTPREQUEST && !hasGoogleImgApi && ((REQUESTED_URL.search("suggest=") > -1) || (REQUESTED_URL.search("output=search") > -1) || (REQUESTED_URL.search("/s?") > -1)) );
      var isBingOMBSearch = ( isBing && T_OTHER && (REQUESTED_URL.search("osjson.aspx") > -1) );
      var isBingSiteSearch = ( (isBing || isDisconnect) && T_SCRIPT && (REQUESTED_URL.search("qsonhs.aspx") > -1) );
      var isBlekkoSearch = ( (isBlekko || isDisconnect) && (T_OTHER || T_XMLHTTPREQUEST) && (REQUESTED_URL.search("autocomplete") > -1) );
      var isYahooSearch = ( (isYahoo || isDisconnect) && T_SCRIPT && (REQUESTED_URL.search("search.yahoo") > -1) && ((REQUESTED_URL.search("jsonp") > -1) || (REQUESTED_URL.search("gossip") > -1)) );

      var isDisconnectSearchPage = (REQUESTED_URL.search("search.disconnect.me/stylesheets/injected.css") > -1);
      if (isDisconnectSearchPage) updatestats();

      // blocking autocomplete by OminiBox or by Site URL
      if ( (isProxied || isDisconnect) && (isChromeInstant || isGoogleOMBSearch || isGoogleSiteSearch || isBingOMBSearch || isBingSiteSearch || isBlekkoSearch || isYahooSearch) ) {
        var blocking = true;
        if (!isDisconnect) {
          if ( (modeSettings==1) && !isGoogleOMBSearch ) blocking = false;
          else if ( (modeSettings==2) && isGoogleSiteSearch && !isSearchByPage ) blocking = false;
        }

        if (blocking) {
          logger.console("BLOCKING REQUEST", REQUESTED_URL);
          return Ci.nsIContentPolicy.REJECT;
        }
      }
      return Ci.nsIContentPolicy.ACCEPT;
    } catch (e) {
      logger.console("shouldLoad Exception:", e);
      return Ci.nsIContentPolicy.ACCEPT;
    }
  },

  shouldProcess: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeType, aExtra, aRequestPrincipal) {
    return Ci.nsIContentPolicy.ACCEPT;
  }
});

// Create and register the factory
var factory = Factory({
  contract:  contractId,
  Component: disconnectSearch
});

/*
//DEPRECIATED 
function onModifyRequest(channel) { 
  if (channel instanceof Ci.nsIHttpChannel && channel instanceof Ci.nsITraceableChannel) {
    // Our own listener for the channel
    var DataListener = {
      QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener,
                        Ci.nsIRequestObserver, Ci.nsIRunnable]),
      oldListener: null,
      receivedData: null,   // array for incoming data.

      run: function() {
        // Replace old listener by our fake listener
        this.oldListener = channel.setNewListener(this);

        // Now we can cancel the channel, listener old won't notice
        //channel.cancel(Components.results.NS_BINDING_ABORTED);
      },

      onDataAvailable: function(request, context, inputStream, offset, count) {
        this.oldListener.onDataAvailable(request, context, inputStream, offset, count);    
      },
 
      onStartRequest: function(request, context) {
        this.receivedData = [];
        this.oldListener.onStartRequest(request, context);
      },

      onStopRequest: function(request, context, status) {
        // Call old listener with our data and set "response" headers
        var stream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
        stream.setData("<script>document.forms[0].onsubmit = function(){ document.location = 'http://www.google.com/search?q='+(document.forms[0].gbqfq.value);  document.forms[0].submit();} </script>", -1)

        this.oldListener.onDataAvailable(request, context, stream, 0, stream.available());
        this.oldListener.onStopRequest(request, context, Cr.NS_OK);
      }
    }

    // We cannot replace the listener right now, see
    // https://bugzilla.mozilla.org/show_bug.cgi?id=646370.
    // Do it asynchronously instead.
    var threadManager = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager);
    threadManager.currentThread.dispatch(DataListener, Ci.nsIEventTarget.DISPATCH_NORMAL);
  }
};
*/ 

var httpRequestObserver = { 
  observe: function(subject, topic, data) {
    var channel = subject;
    //logger.console("Got observer topic:", topic, channel);

    if (topic == "http-on-modify-request") {
      if (!(channel instanceof Ci.nsIHttpChannel)) return;
      
      onHttpModifyRequest(channel);
    } else if (topic == "http-on-examine-response") {
      if (!(channel instanceof Ci.nsIHttpChannel)) return;

      onHttpExamineRespose(channel)
    }
  }
};

function onHttpModifyRequest(channel) {
  //logger.console("Http-on-Modify-Request");
  //var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  try {
    var PARENT = ((channel.loadFlags & Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) > 0);
    var REQUESTED_URL = channel.URI.spec;
    var CHILD_DOMAIN = channel.URI.host;

    //logger.console("Http-on-Modify-Request: ", REQUESTED_URL, PARENT);
    if (PARENT) logger.console("Http-on-Modify-Request:", REQUESTED_URL, PARENT);

    /* generate id request */
    var browser = getBrowserFromChannel(channel);
    if (PARENT && (browser != null)) {
      browser._requestID = ++requestID;   /* request id created */
      if (!(C_DISCONNECT_ID in browser))  /* aditional protection -> implement in openTab */
        browser._disconnectID = ++disconnectID;
      //logger.console("disconnectID: "+browser._disconnectID + " requestID: "+browser._requestID);
    }

    // insert new header (if with proxy set)
    if ( isActiveProxy() || (browser != null && isProxyTab(browser._disconnectID)) ) {
      //logger.console("Sending Header with: ", XDHR.name, XDHR.value);
      channel.setRequestHeader(XDHR.name, XDHR.value, false);
    } 

    // delete the Referer header from all search requests
    try {
      var refererValue = channel.getRequestHeader("Referer");
      if (refererValue.indexOf(C_PROXY_SEARCH) >= 0) {
        channel.setRequestHeader('Referer', null, false);
      }
    }catch(e){}
    
    // delete the Cookie header from all search requests
    try {
      if ((REQUESTED_URL.indexOf(C_PROXY_SEARCH)<0) && isProxyTab(browser._disconnectID) &&
          (proxy_tabs[browser._disconnectID].current_page.indexOf(C_PROXY_SEARCH)>=0) ){
        logger.console("Deleted the Cookie header", "tabId:", browser._disconnectID , "from:", REQUESTED_URL);
        channel.setRequestHeader('Cookie', null, false);
      }
    }catch(e){}
    
    // get more information
    if (sendXDIHR == true) {
      channel.setRequestHeader('XDIHR', 'trace', false);
    }

    /* Traps and selectively cancels or redirects a request. */
    const PROXY_REDIRECT_BY_PRESETTING = "https://" + C_PROXY_PRESETTING;
    const PROXY_REDIRECT = "https://" + C_PROXY_REDIRECT;

    const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
    const REGEX_URL_YAHOO = /[?|&]p=(.+?)(&|$)/;

    var presetting = false;
    var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
    var isBing = (CHILD_DOMAIN.search("bing.") > -1);
    var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
    var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1);
    var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
    var hasSearch = (REQUESTED_URL.search("/search") > -1);
    var hasMaps = (REQUESTED_URL.search("/maps") > -1);
    var hasWsOrApi = (REQUESTED_URL.search("/ws") > -1) || (REQUESTED_URL.search("/api") > -1);
    var isDisconnect = (REQUESTED_URL.indexOf(C_PROXY_SEARCH) >= 0);

    // Search proxied
    var modeSettings = deserialize(localStorage['mode_settings']);
    var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
    var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
    var isProxied = ( ((modeSettings == 0) && isSearchByPopUp) || ((modeSettings == 1) && !isSearchByPage) || (modeSettings >= 2) );
    
    // Redirect URL -> Proxied
    if (isProxied && (PARENT) && ((isGoogle && (hasSearch || hasMaps)) || (isBing && hasSearch) || (isYahoo && hasSearch) || (isBlekko && hasWsOrApi) || isDuckDuckGo)) {
      logger.console("Search by OminiBox");

      // get query in URL string
      var match = REGEX_URL.exec(REQUESTED_URL);
      if (isYahoo) match = REGEX_URL_YAHOO.exec(REQUESTED_URL);

      if ((match != null) && (match.length > 1)) {
        logger.console("Search by OminiBox Found Match Needs Redirecting");

        var firefoxSearch = (current_search == C_FIREFOX_SEARCH);
        var searchEngineIndex = deserialize(localStorage['search_engines']);
        var searchEngineName = null;
        if      ( (searchEngineIndex == 0 && !isSearchByPage && !firefoxSearch) || (isGoogle && isSearchByPage) || (isGoogle && firefoxSearch) ) searchEngineName = 'google';
        else if ( (searchEngineIndex == 1 && !isSearchByPage && !firefoxSearch) || (isBing && isSearchByPage) || (isBing && firefoxSearch) ) searchEngineName = 'bing';
        else if ( (searchEngineIndex == 2 && !isSearchByPage && !firefoxSearch) || (isYahoo && isSearchByPage) || (isYahoo && firefoxSearch) ) searchEngineName = 'yahoo';
        else if ( (searchEngineIndex == 3 && !isSearchByPage && !firefoxSearch) || (isBlekko && isSearchByPage) || (isBlekko && firefoxSearch) ) searchEngineName = 'blekko';
        else if ( (searchEngineIndex == 4 && !isSearchByPage && !firefoxSearch) || (isDuckDuckGo && isSearchByPage) || (isDuckDuckGo && firefoxSearch) ) searchEngineName = 'duckduckgo';
        else searchEngineName = 'google';

        var url_params = buildParameters(REQUESTED_URL, searchEngineName);

        var url_redirect = null;
        if (!isProxyTab(browser._disconnectID) && enablePresetting) {
          url_redirect = PROXY_REDIRECT_BY_PRESETTING + url_params;
          presetting = true;
        } else {
          url_redirect = PROXY_REDIRECT + url_params;
          presetting = false;
        }

        //register the tab as a proxy tab passing in the url we will use as the base search
        registerProxiedTab(browser._disconnectID, PROXY_REDIRECT + url_params, C_SEARCH_REQUEST, presetting);

        var uri = iOService.newURI(url_redirect, "UTF-8", null);
        redirectTo(channel, uri);
      }
    } else if (PARENT && isDisconnect && !isProxyTab(browser._disconnectID)) {
      logger.console("Disconnect Search Page");
      var isHidden = (REQUESTED_URL.search("/browse/") > -1);
      var url_params = "/?s=" + C_MN + "&" + REQUESTED_URL.split("?")[1]
      var url_redirect = PROXY_REDIRECT_BY_PRESETTING + url_params;

      if (!isHidden && enablePresetting) {
        var uri = iOService.newURI(url_redirect, "UTF-8", null);
        registerProxiedTab(browser._disconnectID, PROXY_REDIRECT + url_params, C_SEARCH_REQUEST, true);
        redirectTo(channel, uri);
      } else {
        registerProxiedTab(browser._disconnectID, REQUESTED_URL, C_SEARCH_REQUEST, false);
      }
    } else {
      //logger.console("No Search by OminiBox Just pass through plus one");

      // BEGIN - HACK blekko redirect - only FORM use
      if (isProxied && !PARENT && /jQuery?/.test(REQUESTED_URL) && isBlekko && hasWsOrApi && modeSettings != 1) { //&& T_SCRIPT
        logger.console("FOUND BLEKKO HACK", REQUESTED_URL);
        var dcm = getDocumentFromChannel(channel);
        if (dcm) {
          var jsCode = "window.location = '" + REQUESTED_URL + '&search_plus_one=form'+ "';";
          var script = dcm.createElement('script');
          script.innerHTML = jsCode;
          dcm.body.appendChild(script);
        }
      }
      // END - HACK blekko redirect - only FORM use

      var isWordOmniboxSearch = (REQUESTED_URL.indexOf(".") == -1);
      var isDuckGoRedirSearch = ( isDuckDuckGo && PARENT && (REQUESTED_URL.indexOf("http://r.duckduckgo.com/l/?kh=") > -1) );
      var isYahooRedirSearch = ( isYahoo && PARENT && (REQUESTED_URL.indexOf("http://search.yahoo.com/r/") > -1) && (REQUESTED_URL.search("SIG=") > -1) && (REQUESTED_URL.search("EXP=") > -1));
      if (PARENT && (browser != null)) { // is tab request
        // BEGIN - HACK word search with proxy active on omnibox
        if (isActiveProxy() && isWordOmniboxSearch) {
          var service_engine = (Services.search.defaultEngine == null) ? Services.search.currentEngine : Services.search.defaultEngine;
          if (service_engine != null) {
            var submission = service_engine.getSubmission(CHILD_DOMAIN); // problem with word containing value "/"
            logger.console("HACK word search: ", submission.uri.spec);
            redirectTo(channel, submission.uri);
          }
        // END - HACK word search with proxy active on omnibox
        } else if (isActiveProxy() && (isDuckGoRedirSearch || isYahooRedirSearch)) {
          // HACK duckduckgo and yahoo redirect - +1 result
          // *NOT* update data structure (onWebBeforeRequest)
          logger.console("HACK duckduckgo and yahoo redirect - +1 result");
        } else {
          onWebBeforeRequest(REQUESTED_URL, browser._disconnectID, browser._requestID);
        }
      }
    }
  } catch (e) {
    logger.console("Http-on-Modify-Request Exception:", e, channel.URI.spec);
  }
};

function onWebBeforeRequest(url, tabId, requestId) {
  const PARENT = true;

  if (isProxyTab(tabId)) {
    var currentTabActived = getCurrentTabActived();
    logger.console("TAB REGISTRED:", url, "tabId request:", tabId, "tab_actived:", currentTabActived._disconnectID);
    if (PARENT) {
      logger.console(JSON.stringify(proxy_tabs));

      var isProxied = isProxyTabActived(tabId, url);
      if (isProxied && (proxy_tabs[tabId].search.available == true || isProxyUrl(url)) ) { 
        logger.console("Accessing Pages registered in proxy tab (search/plusOne/plusTwo/ProxyUrl/PreSetting) URL: ", url);
        if(!updateCurrentProxyUrl(tabId, url))
          resetPlusTwoIfPlusOne(tabId, url);

        if (currentTabActived._disconnectID == tabId) setProxy();

      } else if (((proxy_tabs[tabId].plus_one.available == true) || (proxy_tabs[tabId].plus_one.url == url) )) { // || (proxy_tabs[tabId].plus_one.id_request >= 0)
        logger.console("Saving search Plus One URL:", url); 

        if ( ((proxy_tabs[tabId].request_type == C_SEARCH_REQUEST) && (proxy_tabs[tabId].search.available == false)) || 
             ((proxy_tabs[tabId].request_type == C_HISTORY_REQUEST) && (proxy_tabs[tabId].search.available == false) && (proxy_tabs[tabId].plus_one.available == true)) ) {
          logger.console("C_SEARCH_REQUEST");
          proxy_tabs[tabId].plus_one.url = url;
          proxy_tabs[tabId].plus_one.id_request = requestId;
          proxy_tabs[tabId].plus_one.available = false;

          if (currentTabActived._disconnectID == tabId) setProxy();
        }

      } else if (((proxy_tabs[tabId].plus_two.available == true) || (proxy_tabs[tabId].plus_two.url == url) )) { // || (proxy_tabs[tabId].plus_two.id_request >= 0)
        logger.console("Saving search Plus Two URL:", url); 

        if ( ((proxy_tabs[tabId].request_type == C_SEARCH_REQUEST) && (proxy_tabs[tabId].plus_one.available == false)) || 
             ((proxy_tabs[tabId].request_type == C_HISTORY_REQUEST) && (proxy_tabs[tabId].plus_one.available == false) && (proxy_tabs[tabId].plus_two.available == true)) ) {
          logger.console("C_SEARCH_REQUEST");
          proxy_tabs[tabId].plus_two.url = url;
          proxy_tabs[tabId].plus_two.id_request = requestId;
          proxy_tabs[tabId].plus_two.available = false;

          if (currentTabActived._disconnectID == tabId) setProxy();
        }

      }
      else {
        logger.console("Removing proxy tab", tabId, url);
        if (currentTabActived._disconnectID == tabId) removeProxy();
      }

      proxy_tabs[tabId].current_page = url;
      proxy_tabs[tabId].request_type = C_SEARCH_REQUEST;
      logger.console(JSON.stringify(proxy_tabs));
    }
  }
};

/* Adds to the search totals in localStorage*/
function updatestats() {
  const total = parseInt(localStorage['searches_total']) + 1 || 1;
  localStorage['searches_total'] = JSON.stringify(total);
};

function onHttpExamineRespose(channel) {
  //var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  var PARENT = ((channel.loadFlags & Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI) > 0);
  var REQUESTED_URL = channel.URI.spec;

  //logger.console("Http-on-Examine-Response:", REQUESTED_URL, PARENT, channel.responseStatus);
  if (PARENT) logger.console("Http-on-Examine-Response:", REQUESTED_URL, PARENT, channel.responseStatus);

  /* receive header for access transparent proxy */
  if (REQUESTED_URL.indexOf(C_PROXY_SEARCH+"/search") >= 0) {
    try{
      var XDHRReceived = channel.getResponseHeader(XDHR.name);
      logger.console("XDHRReceived="+XDHRReceived);
      if (XDHRReceived) XDHR.value = XDHRReceived;
    }catch(Err){} 
  }

  // if(PARENT && (channel.URI.host.search("google.") > -1)) onModifyRequest(channel);

  // onWebRequestCompleted
  var browser = getBrowserFromChannel(channel);
  if (browser != null) {
    var tabObj = proxy_tabs[browser._disconnectID];
    if (tabObj) {
      if ( (tabObj.search.id_request == C_SEARCH_REQUEST) && (tabObj.preset_in_progress == true || enablePresetting == false) ) {
        tabObj.search.id_request = -1;
        logger.console("Search Changed URL After response: ", tabObj.search.url);
      } else if (tabObj.plus_one.id_request == browser._requestID) {
        tabObj.plus_one.url = REQUESTED_URL;
        tabObj.plus_one.id_request = -1;
        logger.console("PlusOne Changed URL After response: ", REQUESTED_URL);
      } else if (tabObj.plus_two.id_request == browser._requestID) {
        tabObj.plus_two.url = REQUESTED_URL;
        tabObj.plus_two.id_request = -1;
        logger.console("PlusTwo Changed URL After response: ", REQUESTED_URL);
      }
    }
  }

  /*
  if (PARENT && (REQUESTED_URL.indexOf(C_PROXY_PRESETTING) >= 0)) {
    if (isProxyTabActived(browser._disconnectID, REQUESTED_URL)) {
      var tabObj = proxy_tabs[browser._disconnectID];
      if (tabObj && (tabObj.preset_in_progress == true)) {
        tabObj.preset_in_progress = false;
        var dcm = getDocumentFromChannel(channel);
        var script = dcm.createElement('script');
        script.innerHTML = 'window.alert("Page matches ruleset");';
        dcm.body.appendChild(script);
      }
    }
  }
  */
};

function redirectTo(aChannel, aURI) {
  logger.console("redirectTo:", aURI.spec);

  if (("redirectTo" in aChannel) && channelRedirect) {
    logger.console("Found nsIHttpChannel.redirectTo. Using it.");
    try {
      aChannel.redirectTo(aURI);
      return true;
    } catch(e) {
      logger.console("Exception on nsIHttpChannel.redirectTo: ", e);
    }
  } else {
    logger.console("NotFound nsIHttpChannel.redirectTo. Using loadURI.");
    aChannel.cancel(Cr.NS_BINDING_ABORTED);
    getBrowserFromChannel(aChannel).loadURI(aURI.spec, null, null);
    return true;
  }
};

function getBrowserFromChannel(aChannel) {
  try {
    var notificationCallbacks = aChannel.notificationCallbacks ? aChannel.notificationCallbacks : aChannel.loadGroup.notificationCallbacks;
    if (!notificationCallbacks) return null;

    var domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
    return getMostRecentWindow().gBrowser.getBrowserForDocument(domWin.top.document);
  }
  catch (e) {
    //dump(e + "\n");
    return null;
  }
};


function getDocumentFromChannel(aChannel) {
  try {
    var notificationCallbacks = aChannel.notificationCallbacks ? aChannel.notificationCallbacks : aChannel.loadGroup.notificationCallbacks;
    if (!notificationCallbacks) return null;
    return notificationCallbacks.getInterface(Ci.nsIDOMWindow).top.document;
  }
  catch (e) {
    //dump(e + "\n");
    return null;
  }
};

// http://mxr.mozilla.org/mozilla-central/source/browser/base/content/tabbrowser.xml#1454
function onTabCreated(event) {
  logger.console("TAB.open");

  var linkedBrowser = event.target.linkedBrowser;
  linkedBrowser.sessionHistory.addSHistoryListener(historyObserver);

  if (!(C_DISCONNECT_ID in linkedBrowser)) {
    linkedBrowser._disconnectID = ++disconnectID;
  }

  // get active tab

  var activeTab = tabUtils.getActiveTab(getMostRecentWindow());
  var browserActiveTab = tabUtils.getBrowserForTab(activeTab);

  var url = linkedBrowser.contentDocument.location.href;
  var tabId = linkedBrowser._disconnectID;
  var tabOwner = event.target.owner;

  if (tabOwner == undefined) { 
    if (last_tab_actived == browserActiveTab._disconnectID) {
      logger.console("open new link tab or wheel button", event.target.label);
      cloneTabObject(browserActiveTab._disconnectID, tabId, false);
      //logger.console(JSON.stringify(proxy_tabs));
    }
  } else {
    //logger.console(tabOwner);
    //logger.console(tabOwner.label);
    var tabOwnerId = tabOwner.linkedBrowser._disconnectID;
    var tabOwnerUrl = tabOwner.linkedBrowser.contentDocument.location.href;
    var isSearchProxy = (tabOwnerUrl.indexOf(C_PROXY_SEARCH) >= 0);
    var isYahoo = (tabOwnerUrl.indexOf("se=yahoo") >= 0);
    //if (isSearchProxy && isYahoo)// not default page URL
      cloneTabObject(tabOwnerId, tabId, false);
  }

  //console.error(JSON.stringify(proxy_tabs));
};

function onTabReady() {
  logger.console("TAB.ready");
  var urlProxied = tabs[tabs.length-1].url; 

  logger.console("UrlProxied:", urlProxied);
  logger.console("Current Tab Url:", getCurrentTabActived().currentURI.spec);

  if (urlProxied == Services.prefs.getCharPref("browser.newtab.url")) { //default URL
    logger.console("removeProxyTab:", disconnectID);
    removeProxyTab(disconnectID);
    removeProxy();
  }

  logger.console(JSON.stringify(proxy_tabs));
}

function onTabRemoved(event) {
  logger.console("TAB.onRemoved");

  var tabId = event.target.linkedBrowser._disconnectID;
  removeProxyTab(tabId);
};

function onTabActivated(event) {
  var url = event.target.linkedBrowser.contentDocument.location.href;
  var tabId = event.target.linkedBrowser._disconnectID;

  logger.console("onTabActivated:", url, "tabId:", tabId, "lastTabId:", last_tab_actived);
  last_tab_actived = tabId;

  if (isProxyTab(tabId)) {
    if ( isProxyTabActived(tabId, url) || (proxy_tabs[tabId].plus_two.url == "") ) {
      setProxy();
   } else 
      removeProxy();
  } else {
    removeProxy();
  }
};

function injectJsInSearchForm() {
  var jsCode = "";
  jsCode += "$(document).ready(function() {"
  jsCode += "  var search_plus_one = $(\"input[name$='search_plus_one']\").val();";
  jsCode += "  if (search_plus_one!=null) return;";
  jsCode += "  var forms = window.document.getElementsByTagName('form');";
  jsCode += "  forms = [].slice.call(forms, 0);";
  jsCode += "  var done = false;";
  jsCode += "  forms.forEach(function(f) {";
  jsCode += "    if (f.action && !done) {";
  jsCode += "      var element = document.createElement('input');";
  jsCode += "      element.setAttribute('type', 'hidden');";
  jsCode += "      element.setAttribute('name', 'search_plus_one');";
  jsCode += "      element.setAttribute('value', 'form');";
  jsCode += "      f.appendChild(element);";
  //jsCode += "      alert(document.location.href);";
  jsCode += "      done = true;";
  jsCode += "    }";
  jsCode += "  });";
  jsCode += "});";

  pageMod.PageMod({
    include: [/.*google.*/, /.*bing.*/, /.*yahoo.*/, /.*blekko.*/, /.*duckduckgo.*/],
    contentScriptFile: data.url("scripts/vendor/jquery/jquery.js"),
    contentScript: jsCode,
    contentScriptWhen: "start"
  });
};

// register proxy tab id and set proxy
function registerProxiedTab(tabId, searchUrl, idRequest, presetting) {
  //if not already a proxy tab then register it and set the preset in progress to true
  // other wise no need to do preset just need to update the objects contents
    
  logger.console("Current Proxy Tabs:");
  //logger.console(proxy_tabs);
  var isProxyTAB = isProxyTab(tabId);
  if (tabId>0 && !isProxyTAB) {
    logger.console("register new tab.");
    proxy_tabs[tabId] = {
      "request_type": C_SEARCH_REQUEST,
      "preset_in_progress": presetting,
      "search": {"url": (searchUrl ? searchUrl:""), "id_request": (idRequest ? idRequest:0), "available": true},
      "plus_one": {"url": "", "id_request": 0, "available": true},
      "plus_two": {"url": "", "id_request": 0, "available": true}
    };
    coveringPlusOneTwo(proxy_tabs[tabId]);
  } else if (isProxyTAB){
    logger.console("Update tab search");
    proxy_tabs[tabId].request_type = C_SEARCH_REQUEST;
    proxy_tabs[tabId].preset_in_progress = presetting;
    proxy_tabs[tabId].search = {
      "url": (searchUrl ? searchUrl:""),
      "id_request": (idRequest ? idRequest:0),
      "available": true
    }
  }

  if (isProxyTab(tabId)) setProxy();
  logger.console(JSON.stringify(proxy_tabs));
};

function cloneTabObject(tabIdSrc, tabIdDst, withTabSrcDelete) {
  if (isProxyTab(tabIdSrc)) {
    var tabIdSrcObj = proxy_tabs[tabIdSrc];
    proxy_tabs[tabIdDst] = {
      "request_type": C_SEARCH_REQUEST,
      "preset_in_progress": tabIdSrcObj.preset_in_progress,
      "search": {"url": tabIdSrcObj.search.url, "id_request": tabIdSrcObj.search.id_request, "available": tabIdSrcObj.search.available},
      "plus_one": {"url": tabIdSrcObj.plus_one.url, "id_request": tabIdSrcObj.plus_one.id_request, "available": tabIdSrcObj.plus_one.available},
      "plus_two": {"url": tabIdSrcObj.plus_two.url, "id_request": tabIdSrcObj.plus_two.id_request, "available": tabIdSrcObj.plus_two.available}
    };
    if (withTabSrcDelete == true)
      removeProxyTab(tabIdSrc);
    return true;
  }
  return false;
};

function buildParameters(requested_url, searchEngineName){
  var paramJSON = {};
  var parameters = requested_url.split("?")[1].split("&");
  var excludeParam = new Array;//["q"];
  var url_params = "/?s=" + C_MN +  "&se=" + searchEngineName;

  for( var i = 0; i < parameters.length; i++){
    var aux = parameters[i].split("=");
    if(aux[0] == "q" || aux[0] == "p") aux[1] = aux[1].replace(/'/g, "%27");
    paramJSON[aux[0]] = aux[1];
  }
  for( var i = 0; i < excludeParam.length; i++){
    delete paramJSON[excludeParam[i]];
  }
  for(var x in paramJSON){
    url_params += "&" + x + "=" + paramJSON[x];
  }
  
  if (searchEngineName == 'google') {
    if (requested_url.search("/maps")>-1)
      url_params += "&tbm=maps";
  }else if (searchEngineName == 'yahoo') {
      url_params = url_params.replace("&p=", "&q=");
  }

  return url_params;
};

function updateCurrentProxyUrl(tabId, url) {
  //reset plus one and plus 2 (if search change)
  logger.console("updateCurrentProxyUrl", tabId, url);
  var tabObj = proxy_tabs[tabId];
  if (tabObj && isProxyUrl(url)) {
    //logger.console("Updating registered proxy url:", url);
    logger.console("updateCurrentProxyUrl", "before:", tabObj.search.url, "after", url);
    tabObj.search.url = url;

    if ( (url.indexOf(C_PROXY_SEARCH)>=0) && (url.indexOf("s=d2hhdGlmaWRpZHRoaXMx") < 0) ) {
      tabObj.search.available = false;
    }

    tabObj.plus_one = {"url": tabObj.plus_one.url, "id_request": 0, "available": true};
    tabObj.plus_two = {"url": tabObj.plus_two.url, "id_request": 0, "available": true};

    coveringPlusOneTwo(tabObj);
    return true;
  }
  return false;
};

function coveringPlusOneTwo(tabObj) {
  if (tabObj && (deserialize(localStorage['coverage_plus_one_two']) == false) ) {
    var url = "https://disabled";
    tabObj.plus_one = {"url": url, "id_request": -1};
    tabObj.plus_two = {"url": url, "id_request": -1};
  }
};

function resetPlusTwoIfPlusOne(tabId, url) {
  // reset plus two if plus one
  var tabObj = proxy_tabs[tabId];
  if (tabObj && (tabObj.plus_one.url == url)) {
    logger.console("Presetting plus 2 url:", url);
    tabObj.plus_two = {"url": tabObj.plus_two, "id_request": 0, "available": true};
    return true;
  }
  return false;
};

function removeProxyTab(tabId) {
  var value = false
  if (proxy_tabs[tabId]) {
    delete proxy_tabs[tabId];
    value = true;
  }
  return value;
};

function isProxyUrl(url) {
  return (url != null) ? (url.indexOf(C_PROXY_REDIRECT)>=0 || (url.indexOf(C_PROXY_SEARCH)>=0 && url.indexOf(C_PROXY_PRESETTING)<0)) : false;
};

function isProxyTab(tabId) {
  return (proxy_tabs[tabId]==null) ? false : true;
};

function isProxyTabActived(tabId, url) {
  var tabObj = proxy_tabs[tabId];
  if (tabObj)
    return (
      (tabObj.search.url == url) || 
      (tabObj.plus_one.url == url) ||
      (tabObj.plus_two.url == url) ||
      (tabObj.preset_in_progress == true) ||
      (isProxyUrl(url))
    );
  return false;
};

function setProxy() {
  logger.console("ACTIVED: PROXY");

  Services.prefs.setCharPref("network.proxy.http", config_proxied.host);
  Services.prefs.setCharPref("network.proxy.socks", config_proxied.host);
  //Services.prefs.setCharPref("network.proxy.ftp", config_proxied.host);
  Services.prefs.setCharPref("network.proxy.ssl", config_proxied.host);
  Services.prefs.setIntPref("network.proxy.http_port", config_proxied.port);
  Services.prefs.setIntPref("network.proxy.socks_port", config_proxied.port);
  //Services.prefs.setIntPref("network.proxy.ftp_port", config_proxied.port);
  Services.prefs.setIntPref("network.proxy.ssl_port", config_proxied.port);
  Services.prefs.setIntPref("network.proxy.type", 1); // MANUAL

  updateIcon(true);
};

// unset the proxy
function removeProxy() {
  logger.console("DEACTIVED: PROXY");

  Services.prefs.setIntPref("network.proxy.type", 0); // DIRECT
  updateIcon(false);
};

function isActiveProxy() {
  return (Services.prefs.getIntPref("network.proxy.type") != 0);
};

function updateIcon(enabled) {
  if (iconChange == true) {
    var icon_name = (enabled) ? 'images/16_g.png' : 'images/16.png';

    var btn = getMostRecentWindow().document.getElementById('disconnect-search');
    if (btn) btn.image = data.url(icon_name);
  }
};

function getMostRecentWindow() {
  return mediator.getMostRecentWindow('navigator:browser');
};

function barFocusSearch(window) {
  var urlbar = window.document.getElementById('urlbar');
  if (urlbar) {
    urlbar.onfocus = function() {
      current_search = C_OMNIBOX_SEARCH;

      //logger.console("FOCUS URLBAR", current_search);
    };

    //urlbar.onblur = function() { logger.console("BLUR URLBAR", current_search); };
  }

  var searchbar = window.document.getElementById('searchbar');
  if (searchbar) {
    searchbar.onfocus = function() {
      current_search = C_FIREFOX_SEARCH;

      var modeSettings = deserialize(localStorage['mode_settings']);
      if (modeSettings >= 1) { // private omnibox or everywhere
        var CHILD_DOMAIN = Services.search.defaultEngine.searchForm;
        var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
        var isBing = (CHILD_DOMAIN.search("bing.") > -1);
        var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
        var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1);
        var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
        if ( (isGoogle || isBing || isYahoo || isBlekko || isDuckDuckGo) ) {
          logger.console("SUGGEST BLOCK");
          Services.prefs.setBoolPref("browser.search.suggest.enabled", false);
        } else {
          Services.prefs.setBoolPref("browser.search.suggest.enabled", true);
        }
      } else {
        Services.prefs.setBoolPref("browser.search.suggest.enabled", true);
      }

      //logger.console("FOCUS SEARCHBAR", current_search);
    };

    //searchbar.onblur = function(){ logger.console("BLUR SEARCHBAR", current_search); };
  }
}

function injectGoogleForm() {
  var jsgoogle = "";
  jsgoogle += "var form = document.forms[0];";
  jsgoogle += "if (form) { ";
  jsgoogle += "  form.onsubmit = function() { ";
  jsgoogle += "    form.submit(); ";
  jsgoogle += "  } ";
  jsgoogle += "} ";

  pageMod.PageMod({
    include: /.*google.*/,
    contentScript: jsgoogle,
    contentScriptWhen: "ready"
  });
};

function pinterestResquest() {
  Request({
    url: "http://pinterest.com/all/food_drink/",
    onComplete: function (response) {
      logger.console("request Pinterest");
    }
  }).get();
}

function saveOriginalPrefs() {
  var ffPreferences = {
    proxy: {
      http: Services.prefs.getCharPref("network.proxy.http"),
      socks: Services.prefs.getCharPref("network.proxy.socks"),
      ftp: Services.prefs.getCharPref("network.proxy.ftp"),
      ssl: Services.prefs.getCharPref("network.proxy.ssl"),
      http_port: Services.prefs.getIntPref("network.proxy.http_port"),
      socks_port: Services.prefs.getIntPref("network.proxy.socks_port"),
      ftp_port: Services.prefs.getIntPref("network.proxy.ftp_port"),
      ssl_port: Services.prefs.getIntPref("network.proxy.ssl_port"),
      type: Services.prefs.getIntPref("network.proxy.type")
    },
    search: {
      suggestEnabled: Services.prefs.getBoolPref("browser.search.suggest.enabled")
    }
  };

  localStorage['ffPreferences'] = JSON.stringify(ffPreferences);
}

exports.restoreOriginalPrefs = function() {
  var prefs = JSON.parse(localStorage['ffPreferences']);

  Services.prefs.setCharPref("network.proxy.http", prefs.proxy.http);
  Services.prefs.setCharPref("network.proxy.socks", prefs.proxy.socks);
  //Services.prefs.setCharPref("network.proxy.ftp", prefs.proxy.ftp);
  Services.prefs.setCharPref("network.proxy.ssl", prefs.proxy.ssl);
  Services.prefs.setIntPref("network.proxy.http_port", prefs.proxy.http_port);
  Services.prefs.setIntPref("network.proxy.socks_port", prefs.proxy.socks_port);
  //Services.prefs.setIntPref("network.proxy.ftp_port", prefs.proxy.ftp_port);
  Services.prefs.setIntPref("network.proxy.ssl_port", prefs.proxy.ssl_port);
  Services.prefs.setIntPref("network.proxy.type", prefs.proxy.type);

  Services.prefs.setBoolPref("browser.search.suggest.enabled", prefs.search.suggestEnabled);
};

exports.removeProxyUnload = function() {
  removeProxy();
};

exports.loadListeners = function(context) {
  //logger.console('Load Listerners');

  proxy_tabs = [];
  if (deserialize(localStorage['development_mode']) == true) {
    iconChange = logEnabled = sendXDIHR = true;
  }

  logger.initialize(logEnabled);
  saveOriginalPrefs();
  removeProxy();

  categoryManager.addCategoryEntry("content-policy", "http-request", contractId, false, true);
  if (xpcom.isRegistered(factory)) xpcom.unregister(factory);
  xpcom.register(factory);

  observerService.addObserver(httpRequestObserver, "http-on-modify-request", false);
  observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);

  onWindowOpen();
  //tabs.on("ready", onTabReady);
  windows.browserWindows.on('open', onWindowOpen);  
  windows.browserWindows.on('activate', onWindowActivate);

  injectJsInSearchForm();
  injectGoogleForm();

  pinterestResquest();

  /* investigate */
  /*
  //events.on("http-on-modify-request", onHttpModifyRequest);
  //events.on("http-on-examine-response", onHttpExamineRespose);
  events.on("http-on-opening-request", onHttpOpeningRequest);
  events.on("http-on-examine-cached-response", onHttpExamineCachedResponse);
  events.on("http-on-examine-merged-response", onHttpExamineMergedResponse);
  */
};

function onHttpOpeningRequest(event) {
  var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  var REQUESTED_URL = channel.URI.spec;
  //logger.console("Http-on-Opening-Request: ", REQUESTED_URL);
};
function onHttpExamineCachedResponse(event) {
  var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  var REQUESTED_URL = channel.URI.spec;
  //logger.console("Http-on-Examine-Cached-Response: ", REQUESTED_URL);
};
function onHttpExamineMergedResponse(event) {
  var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
  var REQUESTED_URL = channel.URI.spec;
  //logger.console("Http-on-Examine-Merged-Response: ", REQUESTED_URL);
};

function onWindowOpen(){
  logger.console("onWindowOpen");

  var mainWindow = getMostRecentWindow();
  var container = mainWindow.gBrowser.tabContainer;

  container.addEventListener("TabOpen", onTabCreated, false);
  container.addEventListener("TabSelect", onTabActivated, false);
  container.addEventListener("TabClose", onTabRemoved, false);
  barFocusSearch(mainWindow);
};

function getCurrentTabActived() {
  var activeTab = tabUtils.getActiveTab(getMostRecentWindow());
  var browserActiveTab = tabUtils.getBrowserForTab(activeTab);
  return browserActiveTab;
}

function onWindowActivate(){
  var browserActiveTab = getCurrentTabActived();
  var tabId = browserActiveTab._disconnectID;
  var tabUrl = browserActiveTab.currentURI.spec;
  last_tab_actived = tabId;

  logger.console("onWindowActivate:", tabId, tabUrl);
  if (isProxyTab(tabId)) {
    if (isProxyTabActived(tabId, tabUrl) || (proxy_tabs[tabId].plus_two.url == "") )
      setProxy();
    else
      removeProxy();
  }
};