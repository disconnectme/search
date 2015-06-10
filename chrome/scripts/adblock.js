function search_adblock() {
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  var adblock_user_elm = window.document.getElementById('adblock_user_id');
  var adblock_group_elm = window.document.getElementById('adblock_group_id');
  var adblock_ui_elm = window.document.getElementById('adblock_ui');

  if (adblock_user_elm && adblock_group_elm) {
    chrome[runtimeOrExtension].sendMessage({
      action: 'adblock',
      adblock_user_id: adblock_user_elm.innerText,
      adblock_group_id: adblock_group_elm.innerText,
      adblock_ui: adblock_ui_elm.innerText
    }, function(response){});
  }
};

search_adblock();