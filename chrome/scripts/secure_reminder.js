//var script = document.createElement("script");
//script.src = chrome.extension.getURL("/markup/new/modal.js");
//document.documentElement.appendChild(script);

/* Destringifies an object. */
function deserialize(object) {
  return typeof object == 'string' ? JSON.parse(object) : object;
}

$(document).ready(function () {
  var url = chrome.extension.getURL("images/search-notice.png");
  var closeImg = chrome.extension.getURL("images/search-close.png");
  var neverImg = chrome.extension.getURL("images/search-never-show.png");

  var backStyle = '<style type="text/css"> #disconnectme-dialog-box { background-image: url(' + url + '); background-repeat: no-repeat;} </style>';
  var closeStyle = '<style type="text/css"> #disconnectme-closeDiv { background-image: url(' + closeImg + ');'+
                   ' background-repeat: no-repeat; height:40px; position: relative; left: 370px; top:7px; } ' + 
                   '#closePosition { position: absolute; width: 20px; } </style>';

  var neverStyle = '<style type="text/css"> #disconnectme-neverDiv { background-image: url(' + neverImg + '); ' +
                   ' background-repeat: no-repeat; height:40px; position: relative; left: 80px;} </style>';

  close = '<a href="#" class="disconnectme-close" ><div id="disconnectme-closeDiv"></div></a>';
  never = '<a href="#" class="disconnectme-never"><div id="disconnectme-neverDiv"></div></a>';

  $("head").append(backStyle);
  $("head").append(neverStyle);
  $("head").append(closeStyle);

  $("body").append('<div id="disconnectme-dialog-overlay"></div><div id="disconnectme-dialog-box">' + 
    '<div class="disconnectme-dialog-content">' +
    '<div id="closePosition">' + close + '</div> ' + 
    '<div id="disconnectme-dialog-message"></div><br/><br/>' +
    '<div id="disconnectme-dialog-options" style="margin-top: 12px;">'+never+'</div> ' +
    '</div></div>' 
    );

  // if user clicked on button, the overlay layer or the dialogbox, close the dialog  
  $('a.disconnectme-close, #disconnectme-dialog-overlay, #disconnectme-dialog-box').click(function () {   
    $('#disconnectme-dialog-overlay, #disconnectme-dialog-box').hide();
    return false;
  });
  
  $('a.disconnectme-never').click(function () {
    var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
    chrome[runtimeOrExtension].sendMessage({secure_reminder_show: false}, function(response){});
    $('#disconnectme-dialog-overlay, #disconnectme-dialog-box').hide();
    return false;
  });
  
  // if user resize the window, call the same function again
  // to make sure the overlay fills the screen and dialogbox aligned to center  
  $(window).resize(function () {
    //only do it if the dialog box is not hidden
    if (!$('#disconnectme-dialog-box').is(':hidden')) popup();   
  }); 

  popup("<spam id=\"disconnectme-dialog-header\" style=\"margin-top: 18px;\">You are no longer using<br/>a secure connection.</spam>");
});

//Popup dialog
function popup(message) {
  // get the screen height and width  
  var maskHeight = $(document).height();  
  var maskWidth = $(window).width();
  
  // calculate the values for center alignment
  var dialogTop =  100;
  var dialogLeft = 300;
  
  // assign values to the overlay and dialog box
  $('#disconnectme-dialog-overlay').css({height:maskHeight, width:maskWidth}).show();
  $('#disconnectme-dialog-box').css({top:dialogTop, left:dialogLeft}).show();
  
  // display the message
  $('#disconnectme-dialog-message').html(message);    
}