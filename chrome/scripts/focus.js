function sendFocus(focusActive) {
  //document.title = focusActive ? 'focused' : 'not focused';
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  chrome[runtimeOrExtension].sendMessage({page_focus: focusActive}, function(response){});
};

window.addEventListener('keypress', function() { sendFocus(true); });
window.addEventListener('click', function() { sendFocus(true); });
window.addEventListener('blur', function() { sendFocus(false); });
setTimeout(function() { sendFocus(document.hasFocus()); }, 500);