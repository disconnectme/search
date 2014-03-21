/* Paints the UI. */
window.onload = function() {
  const BG = chrome.extension.getBackgroundPage();
  const CHK_MODE_SETTINGS_LABEL = 'chk_mode_settings';
  const TXT_DEFAULT_MESSAGE = 'Search privately';
  const TXT_SEARCH = $('#txt_search');

  initialize();

  function initialize() {
    define_events();
    analytics();
    defaults_values();
  };

  function define_events() {
    $('.mode_settings').click(chkModeSettingsClick);
    $('.checkbox li span').click(spanItemClick);
    $('#btn_search').click(btnSearchClick);
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
    $('#omnibox-box').click(function() {
      var is_checked = $(this).is(':checked');
      localStorage.search_omnibox = is_checked ? "true" : "false";
      if (is_checked) {
        localStorage.search_omnibox_on = parseInt(localStorage.search_omnibox_on) + 1;
      } else {
        localStorage.search_omnibox_off = parseInt(localStorage.search_omnibox_off) + 1;
      }
    });

    $('#everywhere-box').click(function() {
      var is_checked = $(this).is(':checked');
      localStorage.search_everywhere = is_checked ? "true" : "false";
      if (is_checked) {
        localStorage.search_everywhere_on = parseInt(localStorage.search_everywhere_on) + 1;
      } else {
        localStorage.search_everywhere_off = parseInt(localStorage.search_everywhere_off) + 1;
      }
    });
  };

  function defaults_values() {
    TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE);

    var chkbox = '{"ominibox":false,"everywhere":false}';
    try { chkbox = JSON.parse(localStorage[CHK_MODE_SETTINGS_LABEL]); }catch(e){};
    $('#omnibox-box').attr('checked', chkbox['ominibox']);
    $('#everywhere-box').attr('checked', chkbox['everywhere']);

    TXT_SEARCH.focus();
  };

  function chkModeSettingsClick() {
    var omnibox = $('#omnibox-box');
    var everywhere = $('#everywhere-box');

    var chk_box = {
      'ominibox': omnibox.is(':checked'),
      'everywhere': everywhere.is(':checked')
    };
    localStorage[CHK_MODE_SETTINGS_LABEL] = JSON.stringify(chk_box);

    var mode = 0;
    if (everywhere.is(':checked')) mode = 2;
    else if (omnibox.is(':checked')) mode = 1;
    localStorage['mode_settings'] = mode.toString();
  };

  function btnSearchClick() {
    chrome.tabs.create({url: "http://www.google.com/search?q=" + encodeURIComponent(TXT_SEARCH.val()) + '&search_plus_one=popup'});
  };

  function toolBarInfoClick() {
    chrome.tabs.create({url: 'https://disconnect.me/search/info'});
  };

  function emailSupportClick() {
    var emailTo = "support@disconnect.me",
        title = "Disconnect Search support",
        action_url = "mailto:" + emailTo + "?Subject=" + encodeURIComponent(title);
    chrome.tabs.getSelected(function(tab){
      chrome.tabs.update(tab.id, { url: action_url });
    })
  };

  function spanItemClick() {
    $(this).parent().find("input").trigger("click");
  };

  function closePopup() {
    window.close();
  };

  function bubblePopUp() {
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
      marginTop: 12
    });
  };
  function hideHelpImage() {
    var image = $(this).attr('id') == 'mode1_info' ? '#ominibox' : '#everywhere';
    $(image).stop(true,true).animate({
      opacity: 0,
      marginTop: 0
    }, function(){
      $(this).hide();
    });
  };

};