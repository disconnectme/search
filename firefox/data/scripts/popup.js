"use strict";

/* Paints the UI. */
const CHK_MODE_SETTINGS_LABEL = 'chk_mode_settings';
const TXT_DEFAULT_MESSAGE = 'Search privately';
const TXT_SEARCH = $('#txt_search');
var localStorage = {};

function setLocalStorage(key, value){
   self.port.emit("setLocalStorage", key, value);
   localStorage[key] = value;
};

self.port.on("show", function show(localStor) {
  localStorage = JSON.parse(JSON.stringify(localStor));
  defaults_values();
});

function initialize() {
  define_events();
  analytics();
  defaults_values();
};

function define_events() {
  $('.mode_settings').click(chkModeSettingsClick);
  $('.checkbox li span').click(spanItemClick);
  $('#txt_search').keyup(txtSearchKeyUp);
  $('#toolbar_info').click(toolBarInfoClick);
  $('#toolbar_feedback').click(emailSupportClick);
  $("#frm_search").submit(closePopup);

  $('.whats_this').bind({
    mouseenter: showHelpImage,
    mouseleave: hideHelpImage
  });
  $('.beta').bind({
    mouseenter: bubblePopUp,
    mouseleave: closeBubblePopUp
  });

  TXT_SEARCH.focus(function () { $(this).css('background-position', '0px -27px'); });
  TXT_SEARCH.blur(function () { $(this).css('background-position', '0px 0px'); });
};

function analytics() {
  //temporary omnibox/everywhere usage analytics
  $('#omnibox-box').click(function() {
    var is_checked = $(this).is(':checked');
    setLocalStorage('search_omnibox', is_checked ? "true" : "false");
    if (is_checked) {
      var value = localStorage['search_omnibox_on'];
      setLocalStorage('search_omnibox_on', parseInt(value)+1);
    } else {
      var value = localStorage['search_omnibox_off'];
      setLocalStorage('search_omnibox_off', parseInt(value)+1);
    }
  });

  $('#everywhere-box').click(function() {
    var is_checked = $(this).is(':checked');
    setLocalStorage('search_everywhere', is_checked ? "true" : "false");
    if (is_checked) {
      var value = localStorage['search_everywhere_on'];
      setLocalStorage('search_everywhere_on', parseInt(value)+1);
    } else {
      var value = localStorage['search_everywhere_off'];
      setLocalStorage('search_everywhere_off', parseInt(value)+1);
    }
  });
};

function defaults_values() {
  TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE);

  var chkbox = '{"ominibox":false,"everywhere":false}';
  try { chkbox = JSON.parse(localStorage[CHK_MODE_SETTINGS_LABEL]); }catch(e){};
  $('#omnibox-box').attr('checked', chkbox['ominibox']);
  $('#everywhere-box').attr('checked', chkbox['everywhere']);

  TXT_SEARCH.val("");
  TXT_SEARCH.focus();
};

function chkModeSettingsClick() {
  var omnibox = $('#omnibox-box');
  var everywhere = $('#everywhere-box');

  var chk_box = {
    'ominibox': omnibox.is(':checked'),
    'everywhere': everywhere.is(':checked')
  };
  setLocalStorage(CHK_MODE_SETTINGS_LABEL, JSON.stringify(chk_box));

  var mode = 0;
  if (everywhere.is(':checked')) mode = 2;
  else if (omnibox.is(':checked')) mode = 1;
  setLocalStorage('mode_settings', mode.toString());

  TXT_SEARCH.focus();
};

function txtSearchKeyUp(e) {
  const PREFIX_URL = "https://";
  e.which = e.which || e.keyCode;
  if(e.which != 13) return;

  var uri = "http://www.google.com/search?q=" + encodeURIComponent(TXT_SEARCH.val()) + '&search_plus_one=popup';
  self.port.emit("createTab", uri);
};

function toolBarInfoClick() {
  self.port.emit("createTab", "https://disconnect.me/search/info");
};

function emailSupportClick() {
  var emailTo = "support@disconnect.me",
      title = "Disconnect Search support",
      action_url = "mailto:" + emailTo + "?Subject=" + encodeURIComponent(title);
  self.port.emit("createTab", action_url);
};

function spanItemClick() {
  $(this).parent().find("input").trigger("click");
};

function closePopup() {
  window.close();
};

function bubblePopUp(){
  $('#exp-msg').show().css("opacity",0).stop(true,true).animate({
    opacity: 1,
    top: 35
  });
};
function closeBubblePopUp() {
  $('#exp-msg').stop(true,true).animate({
    opacity: 0,
    top: 25
  }, function(){
    $(this).hide();
  });
};

function showHelpImage() {
  var image = $(this).attr('id') == 'mode1_info' ? '#ominibox' : '#everywhere';
  $(image).show().css("opacity",0).stop(true,true).animate({
    opacity: 1,
    top: 46
  });
};
function hideHelpImage() {
  var image = $(this).attr('id') == 'mode1_info' ? '#ominibox' : '#everywhere';
  $(image).stop(true,true).animate({
    opacity: 0,
    top: 21
  }, function(){
    $(this).hide();
  });
};

initialize();