const TABS = chrome.tabs;

/* The domain object. */
var SITENAME = new Sitename;

// Shows user welcome page and records installed version
const newInstallt = deserialize(localStorage['newInstallt']);
if (typeof newInstallt === 'undefined') {
  localStorage['newInstallt'] = "false";
  localStorage['development_mode'] = "false";

  localStorage['chk_mode_settings'] = '{"ominibox":true,"everywhere":false,"secure":false}';
  localStorage['search_engines'] = "0"; // google
  localStorage['mode_settings'] = "1";  // omnibox

  localStorage['secure_reminder_show'] = "false";  // open dialog
  localStorage['secure_search'] = "false";         // hyper secure
  localStorage['coverage_plus_one_two'] = "false"; // coverage +1 & +2

  localStorage.cohort = "7";

  localStorage.omnibox = "true";
  localStorage.everywhere = "false";
  localStorage.versionInstaled = chrome.app.getDetails().version.toString();

  TABS.create({url: 'https://www.disconnect.me/search/welcome'});
  $.get('http://goldenticket.disconnect.me/search');
};

/* Initialize background search plus one */
const bgPlusOne = new DMSP1();
bgPlusOne.loadListeners(bgPlusOne);

/* Destringifies an object. */
function deserialize(object) {
  if (typeof object === 'undefined')
    return undefined;
  else if (typeof object == 'string') 
    return JSON.parse(object);
  else
    return object;
};

/* Traps and selectively cancels or redirects a request. */
chrome.webRequest.onBeforeRequest.addListener(function(details) {
  const PROXY_REDIRECT_BY_PRESETTING = "https://" + bgPlusOne.C_PROXY_PRESETTING;
  const PROXY_REDIRECT = "https://" + bgPlusOne.C_PROXY_REDIRECT;
  const MN = "d2hhdGlmaWRpZHRoaXMx";
  const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
  const REGEX_URL_YAHOO = /[?|&]p=(.+?)(&|$)/;
  const TYPE = details.type;
  const T_MAIN_FRAME = (TYPE == 'main_frame');
  const T_OTHER = (TYPE == 'other');
  const T_SCRIPT = (TYPE == 'script');
  const T_XMLHTTPREQUEST = (TYPE == 'xmlhttprequest');
  const REQUESTED_URL = details.url;
  const CHILD_DOMAIN = SITENAME.get(REQUESTED_URL);

  var blockingResponse = {cancel: false};
  var blocking = presetting = false;
  var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
  var isBing = (CHILD_DOMAIN.search("bing.") > -1);
  var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
  var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1);
  var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
  var hasSearch = (REQUESTED_URL.search("/search") > -1);
  var hasWsOrApi = (REQUESTED_URL.search("/ws") > -1) || (REQUESTED_URL.search("/api") > -1);
  var isDisconnect = bgPlusOne.isProxySearchUrl(REQUESTED_URL);
  var isDisconnectSearchPage = (REQUESTED_URL.search("search.disconnect.me/stylesheets/injected.css") > -1);
  if (isDisconnectSearchPage) updatestats();

  // Search proxied
  var modeSettings = deserialize(localStorage['mode_settings']);
  //var isSecureMode = (deserialize(localStorage['secure_search']) == true);
  var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
  var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
  var isProxied = ( ((modeSettings == 0) && isSearchByPopUp) || ((modeSettings == 1) && !isSearchByPage) || (modeSettings >= 2) );

  // blocking autocomplete by OminiBox or by Site URL
  var isChromeInstant = ( isGoogle && T_MAIN_FRAME && (REQUESTED_URL.search("chrome-instant") > -1) );
  var isGoogleOMBSearch = ( isGoogle && T_OTHER && (REQUESTED_URL.search("/complete/") > -1) );
  var isGoogleSiteSearch = ( isGoogle && T_XMLHTTPREQUEST && ((REQUESTED_URL.search("suggest=") > -1) || (REQUESTED_URL.search("output=search") > -1) || (REQUESTED_URL.search("/s?") > -1)) );
  var isBingOMBSearch = ( isBing && T_OTHER && (REQUESTED_URL.search("osjson.aspx") > -1) );
  var isBingSiteSearch = ( isBing && T_SCRIPT && (REQUESTED_URL.search("qsonhs.aspx") > -1) );
  var isBlekkoSearch = ( isBlekko && (T_OTHER || T_XMLHTTPREQUEST) && (REQUESTED_URL.search("autocomplete") > -1) );
  var isYahooSearch = ( isYahoo && T_SCRIPT && (REQUESTED_URL.search("search.yahoo") > -1) && ((REQUESTED_URL.search("jsonp") > -1) || (REQUESTED_URL.search("gossip") > -1)) );
  if ( isProxied && (isChromeInstant || isGoogleOMBSearch || isGoogleSiteSearch || isBingOMBSearch || isBingSiteSearch || isBlekkoSearch || isYahooSearch) ) {
    blocking = true;

    if ( (modeSettings==1) && !isGoogleOMBSearch ) blocking = false;
    else if ( (modeSettings==2) && isGoogleSiteSearch && !isSearchByPage ) blocking = false;

    if (blocking) {
      blockingResponse = { cancel: true };
    }
  }

  // Redirect URL -> Proxied
  if (isProxied && (T_MAIN_FRAME) && ((isGoogle && hasSearch) || (isBing && hasSearch) || (isYahoo && hasSearch) || (isBlekko && hasWsOrApi) || isDuckDuckGo) && !blocking) { 
    //console.log("%c Search by OminiBox", 'background: #33ffff;');
    //console.log(details);

    // get query in URL string
    var match = REGEX_URL.exec(REQUESTED_URL);
    if (isYahoo) match = REGEX_URL_YAHOO.exec(REQUESTED_URL);

    if ((match != null) && (match.length > 1)) {
      //console.log("%c Search by OminiBox Found Match Needs Redirecting", 'background: #33ffff;');
      //console.log(details);

      var searchEngineIndex = deserialize(localStorage['search_engines']);
      var searchEngineName = null;
      if      ( (searchEngineIndex == 0 && !isSearchByPage) || (isGoogle && isSearchByPage) ) searchEngineName = 'google';
      else if ( (searchEngineIndex == 1 && !isSearchByPage) || (isBing && isSearchByPage) ) searchEngineName = 'bing';
      else if ( (searchEngineIndex == 2 && !isSearchByPage) || (isYahoo && isSearchByPage) ) searchEngineName = 'yahoo';
      else if ( (searchEngineIndex == 3 && !isSearchByPage) || (isBlekko && isSearchByPage) ) searchEngineName = 'blekko';
      else if ( (searchEngineIndex == 4 && !isSearchByPage) || (isDuckDuckGo && isSearchByPage) ) searchEngineName = 'duckduckgo';
      else searchEngineName = 'google';

      // redirect search by proxy
      var query = match[1].replace(/'/g, "%27");
      var url_params = "/?s=" + MN + "&q=" + query + "&se=" + searchEngineName;
      var url_redirect = null;
      if (!bgPlusOne.proxy_actived && !bgPlusOne.isProxyTabActived(details.tabId, REQUESTED_URL)) {
        url_redirect = PROXY_REDIRECT_BY_PRESETTING + url_params;
        presetting = true;
      } else {
        url_redirect = PROXY_REDIRECT + url_params;
        presetting = false;
      }
      //register the tab as a proxy tab passing in the url we will use as the base search
      bgPlusOne.registerProxiedTab(details.tabId, PROXY_REDIRECT + url_params, details.requestId, presetting);

      blockingResponse = {
        redirectUrl: url_redirect
      };
    }
  } else if (T_MAIN_FRAME && isDisconnect && !bgPlusOne.isProxyTab(details.tabId) && !blocking) {
    //console.log("%c Disconnect Search Page",'background: #33ffff;');
    var isHidden = (REQUESTED_URL.search("/browse/") > -1);
    var url_params = "/?s=" + MN + "&" + REQUESTED_URL.split("?")[1]
    var url_redirect = PROXY_REDIRECT_BY_PRESETTING + url_params;

    if (!isHidden) {
      bgPlusOne.registerProxiedTab(details.tabId, PROXY_REDIRECT + url_params, details.requestId, true);
      blockingResponse = { redirectUrl: url_redirect };
    } else {
      bgPlusOne.registerProxiedTab(details.tabId, REQUESTED_URL, details.requestId, false);
    }
  } else if (!blocking){
    //console.log("%c No Search by OminiBox Just pass through plus one",'background: #33ffff;');
    //console.log(details);

    // BEGIN - HACK blekko redirect - only FORM use
    if (isProxied && T_SCRIPT && isBlekko && hasWsOrApi && modeSettings != 1) {
        var jsCode = "window.location = '" + REQUESTED_URL + '&search_plus_one=form'+ "';";
        chrome.tabs.executeScript(details.tabId, {code: jsCode, runAt: "document_start"}, function(){});
    }
    // END - HACK blekko redirect - only FORM use

    // BEGIN - HACK duckduckgo redirect - +1 result
    if (T_MAIN_FRAME && isDuckDuckGo && (REQUESTED_URL.indexOf("http://r.duckduckgo.com/l/?kh=") > -1))
      return blockingResponse;
    // END - HACK duckduckgo redirect - +1 result

    bgPlusOne.onWebBeforeRequest(details);
  } else {
    //console.log("%c BLOCKED",'background: #333333; color:#ff0000');
  }

  return blockingResponse;
}, {urls: ['http://*/*', 'https://*/*']}, ['blocking']);

/* Adds to the search totals in localStorage*/
function updatestats() {
  const total = parseInt(localStorage.searches_total) + 1 || 1;
  localStorage.searches_total = JSON.stringify(total);

  const since = parseInt(localStorage.searches_since_last_ping) + 1 || 1;
  localStorage.searches_since_last_ping = JSON.stringify(since);
};

/* Submits stats every 24 hours. */
function reportUsage() {
  // Ensure we have valid dates.
  var now = new Date();
  var firstPing = new Date(localStorage.firstPing || now);
  var lastPing = new Date(localStorage.lastPing || now);

  const howLongInstalledMsec = now.getTime() - firstPing.getTime();
  const url = 'https://services.disconnect.me/search_ping';
  const oneDayAsMsec = 24 * 60 * 60 * 1000;

  // At least 24 hours between reports.
  if (now.getTime() - lastPing.getTime() >= oneDayAsMsec || (firstPing.getTime() == now.getTime())) {
    // Set post params
    const params = {
      daily: JSON.stringify(howLongInstalledMsec >= oneDayAsMsec),
      weekly: JSON.stringify(howLongInstalledMsec >= 7 * oneDayAsMsec),
      monthly: JSON.stringify(howLongInstalledMsec >= 30 * oneDayAsMsec),
      version: localStorage.versionInstaled || "< 0.0.7.1",
      searches_since_last_ping: localStorage.searches_since_last_ping || "-1",
      searches_total: localStorage.searches_total || "0",
      search_engine: localStorage.search_engines || "Default",
      omnibox: localStorage.omnibox || "false",
      everywhere: localStorage.everywhere || "false",
      cohort: localStorage.cohort || "none"
    }

    $.post(url, params).done(function(data) {
      var now = new Date();
      localStorage.searches_since_last_ping = JSON.stringify(0);
      localStorage.lastPing = now;
      if (localStorage.firstPing == null) {
        localStorage.firstPing = now;
      }
    });
  }
};

// Post anonymous usage data to server on startup.
reportUsage();

// Try to run report every hour - it will only run every 24 hours.
setInterval(reportUsage, 60 * 60 * 1000);

