const C_PROXY_SEARCH = "searchbeta.disconnect.me";
const HOUR_MS = 60 * 60 * 1000;

var page_focus = false;
var get_user_id = function() { return localStorage['search_user_id'] };

function search_init_variables() {
  const newInstallt = deserialize(localStorage['new_install']);

  var firstInstall = (typeof newInstallt === 'undefined');
  if (firstInstall) {
    localStorage['new_install'] = "false";

    localStorage['chk_mode_settings'] = JSON.stringify({'omnibox':true, 'everywhere':false});
    localStorage['search_omnibox'] = "true";
    localStorage['search_everywhere'] = "false";

    localStorage['search_engines'] = "0"; // google
    localStorage['mode_settings'] = "1";  // popup/omnibox only
    localStorage['search_cohort'] = "7";

    localStorage['search_omnibox_on'] = localStorage['search_omnibox_off'] = "0";
    localStorage['search_everywhere_on'] = localStorage['search_everywhere_off'] = "0";
    localStorage['search_total'] = "0";

    localStorage['build_version'] = chrome.app.getDetails().version.toString();
    localStorage['search_group'] = "disconnect";
    localStorage['search_product'] = "websearch";
    localStorage['search_user_id'] = "0";

    chrome.tabs.query({url:'*://search.getadblock.com/*', status:"complete"}, function (tabs) {
      for (var i=0; i<tabs.length; i++) {
        chrome.tabs.executeScript(tabs[i].id, {file:'scripts/adblock.js', runAt:"document_end"});
      }
    });

    chrome.tabs.create({url: 'https://disconnect.me/search/welcome'});
    window.setTimeout(reportUsage, 60000);
  }

  return firstInstall;
};

function getHostname(href) {
  var l = window.document.createElement("a");
  l.href = href;
  return l.hostname;
};

function deserialize(object) {
  return (typeof object == 'string') ? JSON.parse(object) : object;
};

function reportUsage() {
  const oneDayAsMsec = 24 * HOUR_MS;

  var now = new Date();
  var firstPing   = new Date(localStorage.search_first_ping || now);
  var firstUpdate = (firstPing.getTime() == now.getTime());

  var dailyPing      = new Date(localStorage.search_daily_ping || now);
  var weeklyPing     = new Date(localStorage.search_weekly_ping || now);
  var monthlyPing    = new Date(localStorage.search_monthly_ping || now);
  var quarterlyPing  = new Date(localStorage.search_quarterly_ping || now);
  var semiannualPing = new Date(localStorage.search_semiannual_ping || now);
  var yearlyPing     = new Date(localStorage.search_yearly_ping || now);

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
    ua: window.navigator.userAgent,
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

  $.ajax(data.conn, {
    type: data.method,
    data: data,
    success: function(data, textStatus, jqXHR) {
      if (firstUpdate)               localStorage.search_first_ping      = now;
      if (daily || firstUpdate)      localStorage.search_daily_ping      = now;
      if (weekly || firstUpdate)     localStorage.search_weekly_ping     = now;
      if (monthly || firstUpdate)    localStorage.search_monthly_ping    = now;
      if (quarterly || firstUpdate)  localStorage.search_quarterly_ping  = now;
      if (semiannual || firstUpdate) localStorage.search_semiannual_ping = now;
      if (yearly || firstUpdate)     localStorage.search_yearly_ping     = now;
      localStorage.search_omnibox_on = parseInt(localStorage.search_omnibox_on) - report_values_to_send.omnibox_on;
      localStorage.search_omnibox_off = parseInt(localStorage.search_omnibox_off) - report_values_to_send.omnibox_off;
      localStorage.search_everywhere_on = parseInt(localStorage.search_everywhere_on) - report_values_to_send.everywhere_on;
      localStorage.search_everywhere_off = parseInt(localStorage.search_everywhere_off) - report_values_to_send.everywhere_off;
      localStorage.search_total = parseInt(localStorage.search_total) - report_values_to_send.searches_total;
    }
  });
};

function onBeforeRequest(details) {
  const TYPE = details.type;
  const T_MAIN_FRAME = (TYPE == 'main_frame');
  const T_OTHER = (TYPE == 'other');
  const T_SCRIPT = (TYPE == 'script');
  const T_XMLHTTPREQUEST = (TYPE == 'xmlhttprequest');
  
  const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
  const REGEX_URL_YAHOO = /[?|&]p=(.+?)(&|$)/;
  const REQUESTED_URL = details.url;
  const CHILD_DOMAIN = getHostname(REQUESTED_URL);
  const C_EXTENSION_PARAMETER = "&source=extension&extension=chrome"

  var modeSettings = deserialize(localStorage['mode_settings']);
  var blockingResponse = {cancel: false};
  var blocking = false;

  var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
  var isBing = (CHILD_DOMAIN.search("bing.") > -1);
  var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
  var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1);
  var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
  var hasSearch = (REQUESTED_URL.search("/search") > -1);
  var hasMaps = (REQUESTED_URL.search("/maps") > -1);
  var hasWsOrApi = (REQUESTED_URL.search("/ws") > -1) || (REQUESTED_URL.search("/api") > -1);
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
  var isBlekkoSearch = ( isBlekko && (T_OTHER || T_XMLHTTPREQUEST) && (REQUESTED_URL.search("autocomplete") > -1) );
  var isYahooSearch = ( isYahoo && T_SCRIPT && (REQUESTED_URL.search("search.yahoo") > -1) && ((REQUESTED_URL.search("jsonp") > -1) || (REQUESTED_URL.search("gossip") > -1)) );
  
  if ( (isProxied && (isChromeInstant || isGoogleOMBSearch || isGoogleSiteSearch || isBingOMBSearch || isBingSiteSearch || isBlekkoSearch || isYahooSearch)) || 
    (modeSettings==2||modeSettings==3) && (isBingOMBSearch || isBingSiteSearch || isYahooSearch) ) {
    blocking = true;
    blockingResponse = { cancel: true };
  }

  // Redirect URL -> Proxied
  var match = REGEX_URL.exec(REQUESTED_URL);
  if (isYahoo) match = REGEX_URL_YAHOO.exec(REQUESTED_URL);

  var foundQuery = ((match != null) && (match.length > 1));
  var URLToProxy = ((isGoogle && (hasSearch || hasMaps)) || (isBing && hasSearch) || (isYahoo && hasSearch) || (isBlekko && hasWsOrApi) || isDuckDuckGo);

  if (isProxied && T_MAIN_FRAME && URLToProxy && foundQuery && !blocking) { 
    //console.log("%c Search by OminiBox/Everywhere", 'background: #33ffff;');
    localStorage.search_total = parseInt(localStorage.search_total) + 1;

    var searchEngineIndex = deserialize(localStorage['search_engines']);
    var searchEngineName = null;
    if      ( (searchEngineIndex == 0 && !isSearchByPage) || (isGoogle && isSearchByPage) )     searchEngineName = 'Google';
    else if ( (searchEngineIndex == 1 && !isSearchByPage) || (isBing && isSearchByPage) )       searchEngineName = 'Bing';
    else if ( (searchEngineIndex == 2 && !isSearchByPage) || (isYahoo && isSearchByPage) )      searchEngineName = 'Yahoo';
    else if ( (searchEngineIndex == 3 && !isSearchByPage) || (isBlekko && isSearchByPage) )     searchEngineName = 'Blekko';
    else if ( (searchEngineIndex == 4 && !isSearchByPage) || (isDuckDuckGo && isSearchByPage) ) searchEngineName = 'DuckDuckGo';
    else searchEngineName = 'Google';

    var url_redirect = 'https://' + C_PROXY_SEARCH + '/searchTerms/search?query=' + match[1] + C_EXTENSION_PARAMETER + '&ses=' + searchEngineName;
    blockingResponse = {
      redirectUrl: url_redirect
    };
  } else if (!blocking){
    
    //search from websearch page, add parameters(if they aren't there yet) to indicate that extension is already installed.
    var isWebSearch = (REQUESTED_URL.search(C_PROXY_SEARCH + "/searchTerms/search?") > -1);
    var hasNotParametersExtension = (REQUESTED_URL.search(C_EXTENSION_PARAMETER) == -1);
    if (isWebSearch && hasNotParametersExtension) {
      blockingResponse = {
        redirectUrl: REQUESTED_URL + C_EXTENSION_PARAMETER
      };
    }else if ((modeSettings==2 || modeSettings==3) && T_SCRIPT && isBlekko && hasWsOrApi) {
      // HACK blekko redirect - only FORM use
      var jsCode = "window.location = '" + REQUESTED_URL + '&search_plus_one=form'+ "';";
      chrome.tabs.executeScript(details.tabId, {code: jsCode, runAt: "document_start"}, function(){});
    }
  } else if(blocking) {
    //console.log("%c BLOCKED",'background: #333333; color:#ff0000');
  }

  return blockingResponse;
};

function onWebRequestBeforeSendHeaders(details) {
  if (details.url.indexOf(C_PROXY_SEARCH) >= 0) {
    var XDST = {name: 'X-Disconnect-Stats', value: JSON.stringify({
      group_id: localStorage.search_group,
      product_id: localStorage.search_product,
      user_id: get_user_id()
    })};
    details.requestHeaders.push(XDST);
  }

  return {requestHeaders: details.requestHeaders};
};

function onWebNavCreatedNavigationTarget(details) {
  page_focus = true;
};

function onTabsCreated(tab) {
  page_focus = false;
};

function onRuntimeMessage(request, sender, sendResponse) {
  if (request.page_focus == false || request.page_focus == true) {
    if (sender.tab && sender.tab.active == true) {
      page_focus = request.page_focus;
      //console.log("Focus:", this.page_focus);
    }
  } else if (request.action == 'adblock') {
    localStorage['search_group'] = request.adblock_group_id;
    localStorage['search_user_id'] = request.adblock_user_id;
  }
};

function search_load_events() {
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ['http://*/*', 'https://*/*']}, ['blocking']);
  chrome.webRequest.onBeforeSendHeaders.addListener(onWebRequestBeforeSendHeaders, {urls: ['http://*/*', 'https://*/*']}, ['blocking', "requestHeaders"]);
  chrome.webNavigation.onCreatedNavigationTarget.addListener(onWebNavCreatedNavigationTarget);
  chrome.tabs.onCreated.addListener(onTabsCreated);
  chrome[runtimeOrExtension].onMessage.addListener(onRuntimeMessage);
};

function search_initialize() {
  var firstInstall = search_init_variables();
  search_load_events();

  if (!firstInstall) reportUsage();
  setInterval(reportUsage, HOUR_MS);
};

search_initialize();