function DMSP1() {
  // background
  this.BACKGROUND = chrome.extension.getBackgroundPage();

  // variables
  this.C_PROXY_INVISIBLE = "invisible.disconnect.me:3000";
  this.C_PROXY_PRESETTING = "search.disconnect.me/activation";
  this.C_PROXY_SEARCH = "search.disconnect.me";

  // configuration to set our proxy server
  this.config_proxied = {
    mode: "pac_script",
    pacScript: {
      data: "function FindProxyForURL(url, host) {\n" +
            "  return 'PROXY " + this.C_PROXY_INVISIBLE + "';\n" +  
            "}"
      }
  };

  this.page_focus = false;
                    
  // configuration to clear our proxy server 
  this.config_direct = { mode: "direct" };
               
  // timer - alarm (disconnect proxy)
  this.timer = null;
  this.expiryTimer = 10000; //(10 seconds)

  // variable for proxy tabs
  this.proxy_tabs = [];

  // variables proxy_actived
  this.proxy_actived = false;

  // send value in header: X-Disconnect-Auth: 'value'
  this.XDHR = {name: 'X-Disconnect-Auth', value: 'none'};

  this.iconChange = this.sendXDIHR = false;
  if (deserialize(localStorage['development_mode']) == true) {
    this.iconChange = this.sendXDIHR = true;
  }
}

DMSP1.prototype.onWebBeforeRequest = function(details) {
  const PARENT = details.type == 'main_frame';
  var isPrivateMode = (deserialize(localStorage['secure_search']) == false);
  var context = this;
  //console.log('%c WebReq.onBeforeRequest:', 'color: #FF07FA; background: #000000');
  //console.log("Type %s -> URL:%s", details.type, details.url);

  if (this.isProxyTab(details.tabId)) {
    //console.log("Current tab shoudl be proxied");            
    if (!PARENT) { // request images, css, styles, javascript (passed by proxy) -> tab proxied
      //console.log("Getting files for page: %s", details.url);
    } else {
      //console.log('%c New page entered: %s', 'background: #99ffcc;', details.url);
      var tabObj = this.proxy_tabs[details.tabId];
      var isProxied = this.isProxyTabActived(details.tabId, details.url);
      //console.log("This page is actively proxied " + isProxied);
      if (isProxied) {
        // this is already a registered url for this proxy tab
        //console.log('%c Accessing Pages registered in proxy tab (search/plusOne/plusTwo/ProxyUrl/PreSetting) URL: %s', 'color: #0033FF', details.url);
        if(!this.updateCurrentProxyUrl(details.tabId, details.url))
          this.resetPlusTwoIfPlusOne(details.tabId, details.url);

        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
          if (tabs[0].id == details.tabId) context.setProxy();
        });

      } else if ((tabObj.plus_one.url == "") || (tabObj.plus_one.id_request >= 0)) {
        //console.log('%c Saving search Plus One URL: %s', 'color: #0033FF', details.url);
        tabObj.plus_one.url = details.url;
        tabObj.plus_one.id_request = details.requestId;

        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
          if (tabs[0].id == details.tabId) context.setProxy();
        });

      } else if ((tabObj.plus_two.url == "") || (tabObj.plus_two.id_request >= 0)) {
        //console.log('%c Saving search Plus Two URL: %s', 'color: #0033FF', details.url);
        tabObj.plus_two.url = details.url;
        tabObj.plus_two.id_request = details.requestId;

        if (isPrivateMode) {
        } else {
          this.setProxy();
          this.disableProxyIfNecessary(true);
        }
        
      } else {
        //console.log('%c Removing proxy tab, tabId: %s - Url: %s', 'background: #FF0000; color: #BADA55', details.tabId, details.url);
        if (isPrivateMode) {
          chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
            if (tabs[0].id == details.tabId) context.removeProxy();
          });
        }
      }

      // set current tab page
      tabObj.current_page = details.url;
    }
  }
};

DMSP1.prototype.onWebRequestBeforeSendHeaders = function(details) {
  //console.log('%c WebReq.onBeforeSendHeaders:', 'color: #FF07FA; background: #000000');

  // insert new header (if with proxy set)
  if (this.proxy_actived == true) {
    details.requestHeaders.push(this.XDHR);
  }

  // delete the Referer header from all search requests
  for (var i=0; i<details.requestHeaders.length; ++i) {
    if (details.requestHeaders[i].name.toLowerCase() === 'referer') {
      var headerValue = details.requestHeaders[i].value;
      if (headerValue.indexOf(this.C_PROXY_SEARCH) >= 0) {
        //console.log("Deleted the Referer header value", headerValue, "from", details.url);
        details.requestHeaders.splice(i, 1);
      }
      break;
    }
  }

  // delete the Cookie header from all search requests
  if ( (details.url.indexOf(this.C_PROXY_SEARCH)<0) && this.isProxyTab(details.tabId) && (this.proxy_tabs[details.tabId].current_page.indexOf(this.C_PROXY_SEARCH)>=0) ){
    for (var i=0; i<details.requestHeaders.length; ++i) {
      if (details.requestHeaders[i].name.toLowerCase() === 'cookie') {
        //console.log("Deleted the Cookie header", "tabId:", details.tabId, "from:", details.url);
        //console.log(details.requestHeaders[i].value);
        details.requestHeaders.splice(i, 1);
        break;
      }
    }
  }

  // get more information
  if (this.sendXDIHR == true) {
    details.requestHeaders.push({name: 'XDIHR', value: 'trace'});
  }

  return {requestHeaders: details.requestHeaders};
};

DMSP1.prototype.onWebRequestHeadersReceived = function(details) {
  //console.log('%c WebRequest.onHeadersReceived:', 'color: #FF07FA; background: #000000');
  //console.log(details.url);

  // received XDHR from search servers
  var tabObj = this.proxy_tabs[details.tabId];
  if (tabObj && details.url.indexOf(this.C_PROXY_SEARCH+"/search")>=0) { 
    for (var i=0; i<details.responseHeaders.length; ++i) {
      var objHeader = details.responseHeaders[i];
      if (objHeader && (objHeader.name.toLowerCase() === this.XDHR.name.toLowerCase())) {
        this.XDHR.value = objHeader.value;
        //console.log(objHeader);
      }
    }
  }

  return {responseHeaders: details.responseHeaders};
};

DMSP1.prototype.onWebRequestCompleted = function(details) {
  //console.log('%c WebReq.onCompleted:', 'color: #FF07FA; background: #000000');
  //console.log(details);

  var tabObj = this.proxy_tabs[details.tabId];
  if (tabObj) {
    //console.log('%c Found a proxied tab', 'background: #cccc33');
    //console.log(tabObj);
    if ((tabObj.search.id_request == details.requestId) && (tabObj.preset_in_progress == true)) {
      //tabObj.search.url = details.url.replace(this.C_PROXY_PRESETTING, this.C_PROXY_SEARCH);
      this.proxy_tabs[details.tabId].search.id_request = -1;
      //console.log('%c Search Changed URL After response: %s', 'background: #99ffcc;', tabObj.search.url);
    } else if (tabObj.plus_one.id_request == details.requestId) {
      tabObj.plus_one.url = details.url;
      tabObj.plus_one.id_request = -1;
      //console.log('%c PlusOne Changed URL After response: %s', 'background: #99ffcc;', details.url);
    } else if (tabObj.plus_two.id_request == details.requestId) {
      tabObj.plus_two.url = details.url;
      tabObj.plus_two.id_request = -1;

      this.disableProxyIfNecessary(true);  // update timer
      //console.log('%c PlusTwo Changed URL After response: %s', 'background: #99ffcc;', details.url);
    }
  } 
};

DMSP1.prototype.onWebCompleted = function(details) {
  //console.log('%c WebNav.onCompleted:', 'color: #FF07FA; background: #000000');
  //console.log(details.url);
  //console.log(this.proxy_tabs);

  if (this.isProxyTabActived(details.tabId, details.url)) {
    var tabObj = this.proxy_tabs[details.tabId];
    if (tabObj && (tabObj.preset_in_progress == true)) {
      var jsCode = "window.location = '" + tabObj.search.url + "';";
      chrome.tabs.executeScript(details.tabId, {code: jsCode, runAt: "document_end"}, function(){
        tabObj.preset_in_progress = false;
        //console.log("Injecting JavaScript Redirected to proxy search \n%s", tabObj.search.url);
      });
    }
  }

  if (details.tabId > 0)
    this.injectJsInSearchForm(details.tabId, details.url, details.type);
};

DMSP1.prototype.onWebCreatedNavigationTarget = function(details) {
  //console.log('%c WebNav.onCreatedNavigationTarget:', 'color: #FF07FA; background: #000000');
  //console.log(details);
  //console.log(this.proxy_tabs);
  this.cloneTabObject(details.sourceTabId, details.tabId, false);
  //console.log(this.proxy_tabs);
};

DMSP1.prototype.onWebTabReplaced = function(details) {
  //console.log('%c WebNav.onReplaced:', 'color: #FF07FA; background: #000000');
  //console.log(details);
  //console.log(this.proxy_tabs);

  this.cloneTabObject(details.replacedTabId, details.tabId, true);
  //chrome.tabs.reload(details.tabId, {}, function(){}); // force reload to set plusOne or PlusTwo
  var tabObj = this.proxy_tabs[details.tabId];
  if (tabObj) {
    chrome.tabs.get(details.tabId, function(tab) {
      //console.log('%c %s', 'color: #FF07FA; background: #000000', tab.url);
      if (tabObj.plus_one.id_request == 0 && tabObj.plus_one.url == "") {
        tabObj.plus_one.url = tab.url;
        tabObj.plus_one.id_request = -1;
      } else if (tabObj.plus_two.id_request == 0 && tabObj.plus_two.url == "") {
        tabObj.plus_two.url = tab.url;
        tabObj.plus_two.id_request = -1;
      }
    });
  }

  var context = this;
  chrome.tabs.get(details.tabId, function(tab) {
    //console.log("injecting by webTabReplace!");
    context.injectJsInSearchForm(tab.id, tab.url, 'main_frame');
  });

  //console.log(this.proxy_tabs);
};

DMSP1.prototype.onTabCreated = function(tab) {
  //console.log('%c TAB.onCreated', 'color: #FF07FA; background: #000000');
  this.page_focus = false;
};

DMSP1.prototype.onTabRemoved = function(tabId, removeInfo) {
  //console.log('%c TAB.onRemoved', 'color: #FF07FA; background: #000000');
  this.removeProxyTab(tabId);
  //console.log(this.proxy_tabs);
};

DMSP1.prototype.onTabHighlighted = function(highlightInfo) {
  //console.log('%c TAB.onHighlighted', 'color: #FF07FA; background: #000000');
  //console.log(this.proxy_tabs);

  this.disableProxyIfNecessary(true);

  // The dialog should appear when switching from a tab which is actively proxied to a tab which is not.
  if (deserialize(localStorage['secure_reminder_show']) == true) {
    var isPrivateMode = (deserialize(localStorage['secure_search']) == false);
    if (isPrivateMode) { // mode 'Search Tab Only'
      if (this.hasProxy()) { // found proxied tab
        var context = this;

        chrome.proxy.settings.get({'incognito': false}, function(config){
          //console.log(JSON.stringify(config));
          if (config.value.mode == context.config_direct.mode) { // no proxy set
            context.doSecureReminder(highlightInfo.tabId); // alert (could be "proxy") -- *exception chrome:// url
          }
        });  
      }
    }
  }
};

DMSP1.prototype.onTabActivated = function(activeInfo) {
  //console.log('%c TAB.onActivated', 'color: #FF07FA; background: #000000');
  //console.log(this.proxy_tabs);

  var isPrivateMode = (deserialize(localStorage['secure_search']) == false);
  if (isPrivateMode) {
    var context = this;

    window.clearTimeout(this.timer); // clear timer
    if (this.isProxyTab(activeInfo.tabId)) {
      chrome.tabs.get(activeInfo.tabId, function(tab) {
        if ( context.isProxyTabActived(tab.id, tab.url) || (context.proxy_tabs[tab.id].plus_two.url == "") )
          context.setProxy();
        else
          context.removeProxy();
      });
    } else {
      this.removeProxy();
    }
  }
};

DMSP1.prototype.injectJsInSearchForm = function(tabId, url, type) {
  // Access Search Page Enginer without params
  if (type == 'main_frame' || type == undefined) {
    var found = false;
    var CHILD_DOMAIN = this.BACKGROUND.getHostname(url);

    if (CHILD_DOMAIN.indexOf(".google.")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("bing.com")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("yahoo.com")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("blekko.com")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("duckduckgo.com")>=0) found = true;

    var isDisconnect = (CHILD_DOMAIN.indexOf(this.C_PROXY_SEARCH)>=0);
    if (found && !isDisconnect) {
      var jsCode = "";
      //jsCode += "$(document).ready(function() {"
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
//      jsCode += "      alert('JavaScript injected in Search FORM!');";
      jsCode += "      done = true;";
      jsCode += "    }";
      jsCode += "  });";
      //jsCode += "});";
      chrome.tabs.executeScript(tabId, {code: jsCode, runAt: "document_end"}, function(){
        //console.log("Injecting JavaScript Redirected to set value in search page");
      });
    }
  }
};

DMSP1.prototype.doSecureReminder = function(tabId) {
  if (deserialize(localStorage['secure_reminder_show']) == true) {
    chrome.tabs.insertCSS(tabId, {file: "/stylesheets/secure_reminder.css"}, function() {
      chrome.tabs.executeScript(tabId, {file: "/scripts/secure_reminder.js", runAt: "document_start"});
      //console.log("Injecting JavaScript for secure Reminder Show");
    });
  }
};

// register proxy tab id and set proxy
DMSP1.prototype.registerProxiedTab = function(tabId, searchUrl, idRequest, presetting) {
  //if not already a proxy tab then register it and set the preset in progress to true
  // other wise no need to do preset just need to update the objects contents
    
  //console.log("Current Proxy Tabs:");
  //console.log(this.proxy_tabs);
  var isProxyTAB = this.isProxyTab(tabId);
  if (tabId>0 && !isProxyTAB) {
    //console.log("register new tab.");
    this.proxy_tabs[tabId] = {
      "preset_in_progress": presetting,
      "search": {"url": (searchUrl ? searchUrl:""), "id_request": (idRequest ? idRequest:0)},
      "plus_one": {"url": "", "id_request": 0},
      "plus_two": {"url": "", "id_request": 0}
    };
    this.coveringPlusOneTwo(this.proxy_tabs[tabId]);

    this.setProxy(); // set proxy
  } else if (isProxyTAB){
    //console.log("Update tab search");
    this.proxy_tabs[tabId].preset_in_progress = presetting;
    this.proxy_tabs[tabId].search = {
      "url": (searchUrl ? searchUrl:""),
      "id_request": (idRequest ? idRequest:0)
    }
  }
  //console.log("Updated Proxy Tabs:");
  //console.log(this.proxy_tabs);
};

DMSP1.prototype.cloneTabObject = function(tabIdSrc, tabIdDst, withTabSrcDelete) {
  if (this.isProxyTab(tabIdSrc)) {
    var tabIdSrcObj = this.proxy_tabs[tabIdSrc];
    this.proxy_tabs[tabIdDst] = {
      "preset_in_progress": tabIdSrcObj.preset_in_progress,
      "search": {"url": tabIdSrcObj.search.url, "id_request": tabIdSrcObj.search.id_request},
      "plus_one": {"url": tabIdSrcObj.plus_one.url, "id_request": tabIdSrcObj.plus_one.id_request},
      "plus_two": {"url": tabIdSrcObj.plus_two.url, "id_request": tabIdSrcObj.plus_two.id_request}
    };
    if (withTabSrcDelete == true)
      this.removeProxyTab(tabIdSrc);
    return true;
  }
  return false;
};

DMSP1.prototype.updateCurrentProxyUrl = function(tabId, url) {
  //reset plus one and plus 2 (if search change)
  var tabObj = this.proxy_tabs[tabId];
  if (tabObj && this.isProxyUrl(url)) {
    tabObj.search.url = url;
    tabObj.plus_one = {"url": "", "id_request": 0};
    tabObj.plus_two = {"url": "", "id_request": 0};

    this.coveringPlusOneTwo(tabObj);
    //console.log('%c Updating registered proxy url: %s', 'color: #cc33FF', url);
    //console.log(tabObj);
    return true;
  }
  return false;
};

DMSP1.prototype.coveringPlusOneTwo = function(tabObj) {
  if (tabObj && (deserialize(localStorage['coverage_plus_one_two']) == false) ) {
    var url = "https://disabled";
    tabObj.plus_one = {"url": url, "id_request": -1};
    tabObj.plus_two = {"url": url, "id_request": -1};
  }
};

DMSP1.prototype.resetPlusTwoIfPlusOne = function(tabId, url) {
  // reset plus two if plus one
  var tabObj = this.proxy_tabs[tabId];
  if (tabObj && (tabObj.plus_one.url == url)) {
    tabObj.plus_two = {"url": "", "id_request": 0};
    //console.log('%c resetting plus 2 url: %s', 'color: #cc33FF', url);
    //console.log(tabObj);
    return true;
  }
  return false;
};

DMSP1.prototype.removeProxyTab = function(tabId) {
  var value = false
  if (this.proxy_tabs[tabId]) {
    delete this.proxy_tabs[tabId];
    value = true;
  }

  this.disableProxyIfNecessary(true);
  return value;
};

DMSP1.prototype.matchesCurrentProxyUrl = function(tabId, url) {
  var tabObj = this.proxy_tabs[tabId];
  return (tabObj) ? (tabObj.search.url == url) : false;
};

DMSP1.prototype.isProxyUrl = function(url) {
  return (url != null) ? ((url.indexOf(this.C_PROXY_SEARCH)>=0 && url.indexOf(this.C_PROXY_PRESETTING)<0)) : false;
};

DMSP1.prototype.isProxySearchUrl = function(url) {
  var value = false;
  if (url != null)
    if (url.indexOf(this.C_PROXY_SEARCH) >= 0) {
      value = true;
      if ((url == "http://"+this.C_PROXY_SEARCH+"/") || (url == "https://"+this.C_PROXY_SEARCH+"/"))
        value = false;
    }
  return value;
};

DMSP1.prototype.isProxyTab = function(tabId) {
  return (this.proxy_tabs[tabId]==null) ? false : true;
};

DMSP1.prototype.isProxyTabActived = function(tabId, url) {
  var tabObj = this.proxy_tabs[tabId];
  if (tabObj)
    return (
      (tabObj.search.url == url) || 
      (tabObj.plus_one.url == url) ||
      (tabObj.plus_two.url == url) ||
      (tabObj.preset_in_progress == true) ||
      (this.isProxyUrl(url))
    );
  return false;
};

DMSP1.prototype.hasProxy = function() {
  // proxy must be active. While there is some plus_two empty!
  var tabs = this.proxy_tabs;
  for (var key in tabs) {
    var tabObj = tabs[key];
    if (tabObj) {
      if (!tabObj.plus_two.url || (tabObj.plus_two.url && tabObj.plus_two.url == ""))
        return true;
    }
  }
  return false;
};

DMSP1.prototype.disableProxyIfNecessary = function(withTimer) {
  var isPrivateMode = (deserialize(localStorage['secure_search']) == false);
  if (isPrivateMode) {

  } else { // secure mode
    if (this.hasProxy() == false) {
      if (withTimer == true)
        this.setProxyTimer();
      else
        this.removeProxy();
    }
  }
};

DMSP1.prototype.resetProxyTimer = function() {
  window.clearTimeout(this.timer);
};

DMSP1.prototype.setProxyTimer = function() {
  this.resetProxyTimer();
  this.timer = window.setTimeout(this.onAlarm.bind(this), this.expiryTimer);
  //console.log("DEACTIVING: PROXY - WITH TIMER");
};

// set the proxy
DMSP1.prototype.setProxy = function() {
  var context = this;

  this.proxy_actived = true;
  this.resetProxyTimer();
  chrome.proxy.settings.set({value: this.config_proxied, scope: 'regular'}, function() {
    context.updateIcon(true);
    //console.log("ACTIVED: PROXY");
  });
};

// unset the proxy
DMSP1.prototype.removeProxy = function() {
  var context = this;

  this.resetProxyTimer();
  chrome.proxy.settings.set({value: this.config_direct, scope: 'regular'}, function() {
    context.proxy_actived = false;
    context.updateIcon(false);
    //console.log("DEACTIVED: PROXY");
  });
};

DMSP1.prototype.onAlarm = function() {
  this.removeProxy();
};

DMSP1.prototype.onMgmUninstalled = function(id) {
  //console.log('%c Management Uninstall', 'color: #FF07FA; background: #000000');
  this.removeProxy();
};

DMSP1.prototype.onMgmDisabled = function(info) {
  //console.log('%c Management Disabled', 'color: #FF07FA; background: #000000');
  this.removeProxy();
};

String.prototype.count = function(s1) { 
  return (this.length - this.replace(new RegExp(s1,"g"), '').length) / s1.length;
};

DMSP1.prototype.updateIcon = function(enabled) {
  if (this.iconChange == true) {
    var icon_name = (enabled) ? '/images/48_g.png' : '/images/48.png';
    chrome.browserAction.setIcon({path: icon_name});
  }
};

// Message communication
DMSP1.prototype.onRuntimeMessage = function(request, sender, sendResponse) {
  if (request.page_focus == false || request.page_focus == true) {
    if (sender.tab && sender.tab.active == true) {
      this.page_focus = request.page_focus;
      //console.log("Focus in prototypeage:", this.page_focus);
    }
  } else if (request.secure_reminder_show == false) {
      localStorage['secure_reminder_show'] = deserialize(request.secure_reminder_show);
  }
};

DMSP1.prototype.onWindowsFocusChanged = function(windowId) {
  //console.log('%c Windows.onFocusChanged:', 'color: #FF07FA; background: #000000');

  var context=this;
  chrome.windows.getLastFocused({populate: true}, function(win) {
    var foundProxyTab = false;
    var tabs = win.tabs;

    for (var i=0; i<tabs.length; ++i) {
      var tab = tabs[i];
      if ((tab.selected == true) && context.isProxyTab(tab.id)) {
        if (context.isProxyTabActived(tab.id, tab.url) || (context.proxy_tabs[tab.id].plus_two.url == "") ) {
          foundProxyTab = true;
        }
        break;
      }
    }

    if (foundProxyTab)
      context.setProxy();
    else
      context.removeProxy();
  });
};

DMSP1.prototype.loadListeners = function(context){
  //console.log('%c Load Listerners', 'color: #FF07FA; background: #000000');
  context.removeProxy();
  this.proxy_tabs = [];

  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  chrome.webRequest.onCompleted.addListener(context.onWebRequestCompleted.bind(context), {urls: ['http://*/*', 'https://*/*']});
  chrome.webRequest.onBeforeSendHeaders.addListener(context.onWebRequestBeforeSendHeaders.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking', "requestHeaders"]);
  chrome.webRequest.onHeadersReceived.addListener(context.onWebRequestHeadersReceived.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking', "responseHeaders"]);
  chrome.webNavigation.onCompleted.addListener(context.onWebCompleted.bind(context));
  chrome.webNavigation.onCreatedNavigationTarget.addListener(context.onWebCreatedNavigationTarget.bind(context));
  chrome.webNavigation.onTabReplaced.addListener(context.onWebTabReplaced.bind(context));
  chrome.tabs.onCreated.addListener(context.onTabCreated.bind(context));
  chrome.tabs.onRemoved.addListener(context.onTabRemoved.bind(context));
  chrome.tabs.onActivated.addListener(context.onTabActivated.bind(context));
  chrome.tabs.onHighlighted.addListener(context.onTabHighlighted.bind(context));
  chrome.management.onUninstalled.addListener(context.onMgmUninstalled.bind(context));
  chrome.management.onDisabled.addListener(context.onMgmDisabled.bind(context));

  chrome.windows.onFocusChanged.addListener(context.onWindowsFocusChanged.bind(context));
  chrome[runtimeOrExtension].onMessage.addListener(context.onRuntimeMessage.bind(context));
};