const C_PROXY_SEARCH = "ec2-54-204-181-250.compute-1.amazonaws.com";
const HOUR_MS = 60 * 60 * 1000;
var page_focus = false;
var get_user_id = function() { return '0' };

function search_init_variables() {
  const newInstallt = deserialize(localStorage['new_install']);
  if (typeof newInstallt === 'undefined') {
    localStorage['new_install'] = "false";

    localStorage['chk_mode_settings'] = '{"ominibox":true,"everywhere":false}';
    localStorage['search_omnibox'] = "true";
    localStorage['search_everywhere'] = "false";

    localStorage['mode_settings'] = "1";
    localStorage['search_cohort'] = "7";

    localStorage['search_omnibox_on'] = localStorage['search_omnibox_off'] = "0";
    localStorage['search_everywhere_on'] = localStorage['search_everywhere_off'] = "0";
    localStorage['search_total'] = "0";

    localStorage['build_version'] = chrome.app.getDetails().version.toString();
    localStorage['search_group'] = 'disconnect';
    localStorage['search_product'] = 'websearch';

    chrome.tabs.create({url: 'https://disconnect.me/search/welcome'});
    $.get('http://goldenticket.disconnect.me/search');
  }
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
    'user_id=' + (get_user_id() || '0'),
    'build=' + localStorage.build_version,
    'cohort=' + (localStorage.search_cohort || 'none')
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
  const T_XMLHTTPREQUEST = (TYPE == 'xmlhttprequest');
  
  const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
  const REQUESTED_URL = details.url;
  const CHILD_DOMAIN = getHostname(REQUESTED_URL);

  var modeSettings = deserialize(localStorage['mode_settings']);
  var blockingResponse = {cancel: false};
  var blocking = false;

  var isGoogle = (CHILD_DOMAIN.search("google.")>-1);
  var hasSearch = (REQUESTED_URL.search("/search")>-1);
  var hasGoogleImgApi = (REQUESTED_URL.search("tbm=isch")>-1);

  var isOmniboxSearch = (page_focus == false);
  var isSearchByPage  = new RegExp("search_plus_one=form").test(REQUESTED_URL);
  var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
  var isProxied = ( 
    (modeSettings == 0 && isSearchByPopUp) ||
    (modeSettings == 1 && (isSearchByPopUp || isOmniboxSearch) ) ||
    (modeSettings == 2 && (isSearchByPopUp || isOmniboxSearch || !isOmniboxSearch || isSearchByPage ) )
  );

  // blocking autocomplete by OminiBox or by Site URL
  var isChromeInstant = ( isGoogle && T_MAIN_FRAME && (REQUESTED_URL.search("chrome-instant") > -1) );
  var isGoogleOMBSearch = ( isGoogle && T_OTHER && (REQUESTED_URL.search("/complete/") > -1) );
  var hasGoogleReviewDialog = (REQUESTED_URL.search("reviewDialog") > -1);
  var isGoogleSiteSearch = (!T_MAIN_FRAME && isGoogle && !hasGoogleImgApi && !hasGoogleReviewDialog &&
    ((REQUESTED_URL.search("suggest=") > -1) || (REQUESTED_URL.indexOf("output=search") > -1) || (REQUESTED_URL.indexOf("/s?") > -1) ||
    (REQUESTED_URL.search("/complete/search") > -1) || (REQUESTED_URL.search("/search") > -1)));

  if (isProxied && (isChromeInstant || isGoogleOMBSearch || isGoogleSiteSearch)) {
    blocking = true;
    blockingResponse = { cancel: true };
  }

  // Redirect URL -> Proxied
  var match = REGEX_URL.exec(REQUESTED_URL);
  var foundQuery = ((match != null) && (match.length > 1));
  var URLToProxy = (isGoogle && hasSearch);
  if (isProxied && T_MAIN_FRAME && URLToProxy && foundQuery && !blocking) { 
    //console.log("%c Search by OminiBox/Everywhere", 'background: #33ffff;');
    localStorage.search_total = parseInt(localStorage.search_total) + 1;

    var url_redirect = 'https://' + C_PROXY_SEARCH + '/searchTerms/search?query=' + match[1];
    blockingResponse = {
      redirectUrl: url_redirect
    };
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
      user_id: (get_user_id() || '0')
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
  search_init_variables();
  search_load_events();

  reportUsage();
  setInterval(reportUsage, HOUR_MS);
};

search_initialize();