/* Paints the UI. */
window.onload = function() {
  const BACKGROUND = chrome.extension.getBackgroundPage();
  const DESERIALIZE = BACKGROUND.deserialize;
  const SEARCH_ENGINE_LABEL = 'search_engines';
  const CHK_MODE_SETTINGS_LABEL = 'chk_mode_settings';
  const TXT_SEARCH = $('#txt_search');
  const TXT_DEFAULT_MESSAGE = 'Search privately';

  initialize();

  function initialize() {
    // set variables in localStorage
    define_variables();

    // set functions/events
    define_events();

    //temporary omnibox/everywhere/secure usage analytics
    analytics();

    // default values
    defaults_values();
  };

  function define_variables() {
  };

  function define_events() {
    $('#btn_search').click(btnSearchClick);
    $('#toolbar_info').click(toolBarInfoClick);
    $('#toolbar_feedback').click(emailSupportClick);
    $('.checkbox li, .mode_settings').click(checkItem);
    $('.search_engines').click(chkSearchEngineClick);
    $('.mode_settings').click(chkModeSettingsClick);
    $('.search_mode').click(chkModeSettingsClick);
    $('.whats_this').bind({
      mouseenter: showHelpImage,
      mouseleave: hideHelpImage
    });
    $('.beta').bind({
      mouseenter: bubblePopUp,
      mouseleave: closeBubblePopUp
    })
    $('.icone_close').click(iconeCloseClick);

    TXT_SEARCH.focus(function () { $(this).css('background-position', '0px -27px'); });
    TXT_SEARCH.blur(function () { $(this).css('background-position', '0px 0px'); });
  };

  function analytics() {
    //temporary omnibox/everywhere/secure usage analytics
    $('#omnibox-box').click(function() {
        var omnibox = $('#omnibox-box');
        if (omnibox.is(':checked')) {
          $.get("https://disconnect.me/search/omnibox/enabled");
          localStorage.omnibox = "true";
        }
        else {
          $.get("https://disconnect.me/search/omnibox/disabled");
          localStorage.omnibox = "false";
        }
    });

    $('#everywhere-box').click(function() {
        var everywhere = $('#everywhere-box');
        if (everywhere.is(':checked')) {
          $.get("https://disconnect.me/search/everywhere/enabled");
          localStorage.everywhere = "true";
        }
        else {
          $.get("https://disconnect.me/search/everywhere/disabled");
          localStorage.everywhere = "false";
        }
    });

    TXT_SEARCH.focus(function () { $(this).css('background-position', '0px -27px'); });
    TXT_SEARCH.blur(function () { $(this).css('background-position', '0px 0px'); });
  };

  function defaults_values() {
    var o_se = $(':input[class="'+SEARCH_ENGINE_LABEL+'"][value="'+ DESERIALIZE(localStorage[SEARCH_ENGINE_LABEL]) +'"]');
    if (o_se != undefined) {
      o_se.attr('checked', true).parent().addClass("active");
      //TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE.format(o_se.next().text()));
      TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE);
    }

    updateSearchEngineIcon(localStorage[SEARCH_ENGINE_LABEL]);

    var chkbox = JSON.parse(localStorage[CHK_MODE_SETTINGS_LABEL]);
    $('#omnibox-box').attr('checked', chkbox['ominibox']);
    $('#everywhere-box').attr('checked', chkbox['everywhere']);

    if (chkbox['secure'] == false)
      $('#private_mode').attr('checked', true);
    else
      $('#secure_mode').attr('checked', true);

    TXT_SEARCH.focus();
  };


  function btnSearchClick() {
    const PREFIX_URL = "https://";
    var searchEngineIndex = DESERIALIZE(localStorage[SEARCH_ENGINE_LABEL]);
    var uri = null;

    if (searchEngineIndex == 0) uri = 'www.google.com/search/?q=';
    else if (searchEngineIndex == 1) uri = 'us.bing.com/search/?q=';
    else if (searchEngineIndex == 2) uri = 'search.yahoo.com/search/?p=';
    else if (searchEngineIndex == 3) uri = 'blekko.com/ws/?q=';
    else if (searchEngineIndex == 4) uri = 'duckduckgo.com/?q=';

    chrome.tabs.create({
      url: PREFIX_URL + uri + TXT_SEARCH.val() + '&search_plus_one=popup'
    });
  };

  function chkSearchEngineClick() {
    var checkbox = $(this),
        checkbox_class = "." + checkbox.attr("class");

    $(checkbox_class).attr("checked",false).parent().removeClass("active").find("span").removeClass("flipInYGreen animated");
    // save value in localstorage
    localStorage[SEARCH_ENGINE_LABEL] = DESERIALIZE(checkbox.attr('value'));

    updateSearchEngineIcon(localStorage[SEARCH_ENGINE_LABEL]);

    // force checked (always true);
    if (!checkbox.is(':checked'))
      checkbox.prop('checked', true).parent().addClass("active").find("span").addClass("flipInYGreen animated");
    };

  function chkModeSettingsClick() {
    var omnibox = $('#omnibox-box');
    var everywhere = $('#everywhere-box');
    var secure = $('#secure_mode');

    var chk_box = {
      'ominibox': omnibox.is(':checked'),
      'everywhere': everywhere.is(':checked'),
      'secure': secure.is(':checked')
    };
    localStorage[CHK_MODE_SETTINGS_LABEL] = JSON.stringify(chk_box);

    var mode = 0;
    if (everywhere.is(':checked')) mode = 2;
    else if (omnibox.is(':checked')) mode = 1;
    localStorage['mode_settings'] = DESERIALIZE(mode);

    if (secure.is(':checked') == true) {
      if (BACKGROUND.bgPlusOne.hasProxy()) {
        BACKGROUND.bgPlusOne.setProxy();
      }
    } else {
      chrome.tabs.query({active: true}, function (tabs) {
        if (!BACKGROUND.bgPlusOne.isProxyTab(tabs[0].id)) {
          BACKGROUND.bgPlusOne.removeProxy();
        }
      });
    }

    localStorage['secure_search'] = DESERIALIZE(secure.is(':checked'));
  };

  function bubblePopUp(){
    $('#exp-msg').show().css("opacity",0).stop(true,true).animate({
      opacity: 1,
      top: 35
    });
  }

  function closeBubblePopUp() {
    $('#exp-msg').stop(true,true).animate({
      opacity: 0,
      top: 25
    });
  }

  function showHelpImage() {
    // clientResize(350);
    var image = $(this).attr('id') == 'mode1_info' ? '#ominibox' : '#everywhere';
    $(image).show().css("opacity",0).stop(true,true).animate({
      opacity: 1,
      marginTop: 12
    });
    // $(image).stop(true,true).css("opacity", 0).show().stop(true,true).animate({
    //   opacity: 1,
    //   top: 211
    // });
  }
  function hideHelpImage() {
    // clientResize(211);
    var image = $(this).attr('id') == 'mode1_info' ? '#ominibox' : '#everywhere';
    $(image).stop(true,true).animate({
      opacity: 0,
      marginTop: 0
    }, function(){
      $(this).hide();
    });
    // $(image).stop(true,true).animate({
    //   opacity: 0,
    //   top: 221
    // }, function(){
    //   $(this).hide();
    // });
  }

  function emailSupportClick() {
    var emailTo = "support@disconnect.me",
          title = "Disconnect Search Support and Feedback",
          action_url = "mailto:" + emailTo + "?Subject=" + encodeURIComponent(title);
    chrome.tabs.getSelected(function(tab){
      chrome.tabs.update(tab.id, { url: action_url });
    })
  }

  function iconeCloseClick() {
    $('.icone_close').removeClass('icone_close_absolute');
    $('#ominibox').fadeOut('fast');
    $('#everywhere').fadeOut('fast');

    clientResize(211); //clientResize('272px');
    $('#settings').fadeIn('slow');
  };

  function toolBarInfoClick() {
    chrome.tabs.create({url: 'http://disconnect.me/search/info'});
  };

  function clientResize(height) {
    $('html,body').stop(true,true).animate({
      "height":height
    })
  };

  function checkItem(){
    if ($(this).hasClass("mode_settings")) {
      $(this).trigger("click");
    } else {
      $(this).find("input").trigger("click");
    }
  }

  function updateSearchEngineIcon(x) {
    var icon;
    if (x == 0) icon = "google";
    else if (x == 1) icon = "bing";
    else if (x == 2) icon = "yahoo";
    else if (x == 3) icon = "blekko";
    else if (x == 4) icon = "duckduckgo";
    document.getElementById("search_engine").className = icon;
  }

};

String.prototype.format = String.prototype.f = function() {
  var s = this, i = arguments.length;
  while (i--) {
    s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
  }
  return s;
};