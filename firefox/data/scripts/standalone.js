"use strict";

/* Paints the UI. */

  const SEARCH_ENGINE_LABEL = 'search_engines';
  const CHK_MODE_SETTINGS_LABEL = 'chk_mode_settings';
  const TXT_SEARCH = $('#txt_search');
  const TXT_DEFAULT_MESSAGE = 'Search privately';
  var localStorageScript = new Array;

  /* Destringifies an object. */
  function DESERIALIZE(object) {
    return (typeof object == 'string') ? JSON.parse(object) : object; 
  }

  function setLocalStorage(key, value){
     self.port.emit("setLocalStorage", key, value);
     localStorageScript[key] = value;
  };

  function getLocalStorage(key){
    return localStorageScript[key]; 
  };

  initialize();

  function initialize() {
    self.port.emit("getLocalStorage");

    setTimeout( function() {
      // set variables in localStorage
      define_variables();

      // set functions/events
      define_events();

      //temporary omnibox/everywhere/secure usage analytics
      analytics();

      // default values
      defaults_values();

      updateSearchEngineIcon(getLocalStorage(SEARCH_ENGINE_LABEL));
    }, 1000);
  };

  function define_variables() { };

  function define_events() {
    $('#txt_search').keyup(txtSearchKeyUp);
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
          setLocalStorage('omnibox' , "true");
        }
        else {
          $.get("https://disconnect.me/search/omnibox/disabled");
          setLocalStorage('omnibox' , "false");
        }
    });

    $('#everywhere-box').click(function() {
        var everywhere = $('#everywhere-box');
        if (everywhere.is(':checked')) {
          $.get("https://disconnect.me/search/everywhere/enabled");
          setLocalStorage('everywhere' , "true");
        }
        else {
          $.get("https://disconnect.me/search/everywhere/disabled");
          setLocalStorage('everywhere' , "false");
        }
    });
  };

  function defaults_values() {
    var o_se = $(':input[class="'+SEARCH_ENGINE_LABEL+'"][value="'+ DESERIALIZE(getLocalStorage(SEARCH_ENGINE_LABEL)) +'"]');
    if (o_se != undefined) {
      o_se.attr('checked', true);
      //TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE.format(o_se.next().text()));
      TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE);
    }

    updateSearchEngineIcon(getLocalStorage(SEARCH_ENGINE_LABEL));
        
    var chkbox = JSON.parse(getLocalStorage(CHK_MODE_SETTINGS_LABEL));
    
    $('#omnibox-box').attr('checked', chkbox['ominibox']);
    $('#everywhere-box').attr('checked', chkbox['everywhere']);

    if (chkbox['secure'] == false)
      $('#private_mode').attr('checked', true);
    else
      $('#secure_mode').attr('checked', true);

    TXT_SEARCH.focus();
  };

  function txtSearchKeyUp(e) {
    const PREFIX_URL = "https://";
    e.which = e.which || e.keyCode;
    if(e.which != 13) return;

    var searchEngineIndex = DESERIALIZE(getLocalStorage(SEARCH_ENGINE_LABEL));
    var uri = null;

    if (searchEngineIndex == 0) uri = 'www.google.com/search?q=';
    else if (searchEngineIndex == 1) uri = 'us.bing.com/search?q=';
    else if (searchEngineIndex == 2) uri = 'search.yahoo.com/search?p=';
    else if (searchEngineIndex == 3) uri = 'blekko.com/ws?q=';
    else if (searchEngineIndex == 4) uri = 'duckduckgo.com/?q=';

    self.port.emit("createTab", PREFIX_URL + uri + encodeURIComponent(TXT_SEARCH.val()) + '&search_plus_one=popup');
  };

  function chkSearchEngineClick() {
    var checkbox = $(this),
    checkbox_class = "." + checkbox.attr("class");
    
    $(checkbox_class).attr("checked",false).parent().removeClass("active").find("span").removeClass("flipInYGreen animated");
    // save value in localstorage
    setLocalStorage(SEARCH_ENGINE_LABEL, DESERIALIZE(checkbox.attr('value')));
    
    updateSearchEngineIcon(getLocalStorage(SEARCH_ENGINE_LABEL));
    // force checked (always true);
    if (!checkbox.is(':checked'))
      checkbox.prop('checked', true).parent().addClass("active").find("span").addClass("flipInYGreen animated");
    TXT_SEARCH.focus();
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
    setLocalStorage(CHK_MODE_SETTINGS_LABEL, JSON.stringify(chk_box));

    var mode = 0;
    if (everywhere.is(':checked')) mode = 2;
    else if (omnibox.is(':checked')) mode = 1;
    setLocalStorage('mode_settings' , DESERIALIZE(mode));

    setLocalStorage('secure_search', DESERIALIZE(secure.is(':checked')));
    TXT_SEARCH.focus();
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

  function emailSupportClick() {
    var emailTo = "support@disconnect.me",
          title = "Disconnect Search support",
     action_url = "mailto:" + emailTo + "?Subject=" + encodeURIComponent(title);
     self.port.emit("email", action_url);
  };

  function iconeCloseClick() {
    $('.icone_close').removeClass('icone_close_absolute');
    $('#ominibox').fadeOut('fast');
    $('#everywhere').fadeOut('fast');

    $('#settings').fadeIn('slow');
  };

  function toolBarInfoClick() {
    self.port.emit("createTab", "http://disconnect.me/search/info");
  };

  function checkItem(){
    if ($(this).hasClass("mode_settings")) {
      $(this).trigger("click");
    } else {
      $(this).find("input").trigger("click");
    }
  };

  function updateSearchEngineIcon(x) {
    var icon;
    if (x == 0) icon = "google";
    else if (x == 1) icon = "bing";
    else if (x == 2) icon = "yahoo";
    else if (x == 3) icon = "blekko";
    else if (x == 4) icon = "duckduckgo";
    document.getElementById("search_engine").className = icon;
    $("#se_"+icon).prop('checked', true).parent().addClass("active").find("span").addClass("flipInYGreen animated");
  };

  self.port.on("handleLocalStorage", function handleLocalStorage(value) {     
    localStorageScript = JSON.parse(JSON.stringify(value));
  });

  self.port.on("show", function show(show, x) {
    TXT_SEARCH.val("");
    TXT_SEARCH.focus();
  });

  String.prototype.format = String.prototype.f = function() {
    var s = this, i = arguments.length;
    while (i--) {
      s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
  };