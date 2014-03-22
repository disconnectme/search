/* Paints the UI. */
window.onload = function() {
  const BG = chrome.extension.getBackgroundPage();
  const DESERIALIZE = BG.deserialize;
  const TXT_SEARCH = $('#txt_search');
  const SEARCH_ENGINE_LABEL = 'search_engines';
  const CHK_MODE_SETTINGS_LABEL = 'chk_mode_settings';
  const TXT_DEFAULT_MESSAGE = 'Search privately';

  initialize();

  function initialize() {
    define_events();
    analytics();
    defaults_values();
  };

  function define_events() {
    $('#btn_search').click(submitSearch);
    $('#txt_search').keyup(submitSearch);
    $('#toolbar_info').click(toolBarInfoClick);
    $('#toolbar_feedback').click(emailSupportClick);
    $('#support').click(supportClick);
    $('#search_select .checkbox li').click(checkItemClick);
    $('.search_engines').click(chkSearchEngineClick);
    $('.mode_settings').click(chkModeSettingsClick);
    $('.whats_this').bind({
      mouseenter: showHelpImage,
      mouseleave: hideHelpImage
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
    var o_se = $(':input[class="'+SEARCH_ENGINE_LABEL+'"][value="'+ DESERIALIZE(localStorage[SEARCH_ENGINE_LABEL]) +'"]');
    if (o_se != undefined) {
      o_se.attr('checked', true).parent().addClass("active");
      //TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE.format(o_se.next().text()));
      TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE);
    }

    updateSearchEngineIcon(localStorage[SEARCH_ENGINE_LABEL]);

    var chkbox = '{"omnibox":false,"everywhere":false}';
    try { chkbox = JSON.parse(localStorage[CHK_MODE_SETTINGS_LABEL]); }catch(e){};
    $('#omnibox-box').attr('checked', chkbox['omnibox']);
    $('#everywhere-box').attr('checked', chkbox['everywhere']);

    TXT_SEARCH.focus();
  };

  function chkModeSettingsClick() {
    var omnibox = $('#omnibox-box');
    var everywhere = $('#everywhere-box');

    var chk_box = {
      'omnibox': omnibox.is(':checked'),
      'everywhere': everywhere.is(':checked')
    };
    localStorage[CHK_MODE_SETTINGS_LABEL] = JSON.stringify(chk_box);

    var mode = 0;
    if      (chk_box.everywhere==false && chk_box.omnibox==true) mode = 1;
    else if (chk_box.everywhere==true && chk_box.omnibox==false) mode = 2;
    else if (chk_box.everywhere==true && chk_box.omnibox==true)  mode = 3;
    localStorage['mode_settings'] = DESERIALIZE(mode);
  };

  function chkSearchEngineClick() {
    var checkbox = $(this),
      checkbox_class = "." + checkbox.attr("class");

    $(checkbox_class).attr("checked", false).parent().removeClass("active").find("span").removeClass("flipInYGreen animated");
    
    localStorage[SEARCH_ENGINE_LABEL] = DESERIALIZE(checkbox.attr('value'));
    updateSearchEngineIcon(localStorage[SEARCH_ENGINE_LABEL]);

    // force checked (always true);
    if (!checkbox.is(':checked'))
      checkbox.prop('checked', true).parent().addClass("active").find("span").addClass("flipInYGreen animated");
  };

  function submitSearch(e) {
    const PREFIX_URL = "https://";

    e.which = e.which || e.keyCode;
    if (e.which != 13 && e.which != 1) return;
    if (TXT_SEARCH.val().trim() == "") return;

    var searchEngineIndex = DESERIALIZE(localStorage[SEARCH_ENGINE_LABEL]);
    var uri = null;

    if (searchEngineIndex == 0) uri = 'www.google.com/search?q=';
    else if (searchEngineIndex == 1) uri = 'us.bing.com/search?q=';
    else if (searchEngineIndex == 2) uri = 'search.yahoo.com/search?p=';
    else if (searchEngineIndex == 3) uri = 'blekko.com/ws?q=';
    else if (searchEngineIndex == 4) uri = 'duckduckgo.com/?q=';

    uri = PREFIX_URL + uri + encodeURIComponent(TXT_SEARCH.val()) + '&search_plus_one=popup';
    chrome.tabs.create({url: uri});

    window.close();
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

  function supportClick() {
    chrome.tabs.create({url: 'https://disconnect.me/search/welcome'});
  };

  function checkItemClick() {
    $(this).find("input").trigger("click");
  };

  function updateSearchEngineIcon(x) {
    var icon;
    if (x == 0) icon = "google";
    else if (x == 1) icon = "bing";
    else if (x == 2) icon = "yahoo";
    else if (x == 3) icon = "blekko";
    else if (x == 4) icon = "duckduckgo";

    document.getElementById("search_engine").className = icon;
  };

  function showHelpImage() {
    var image = $(this).attr('id') == 'mode1_info' ? '#omnibox' : '#everywhere';
    $(image).show().css("opacity",0).stop(true,true).animate({
      opacity: 1,
      marginTop: 12
    });
  };
  function hideHelpImage() {
    var image = $(this).attr('id') == 'mode1_info' ? '#omnibox' : '#everywhere';
    $(image).stop(true,true).animate({
      opacity: 0,
      marginTop: 0
    }, function(){
      $(this).hide();
    });
  };

};
