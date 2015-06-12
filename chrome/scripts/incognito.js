//incognito mode
if(window.location.origin == "https://search.disconnect.me" || window.location.origin == "https://searchbeta.disconnect.me") {
  var normal_results = document.querySelector("#normal-results");
  if (normal_results != null) {
    var results = normal_results.getElementsByTagName("a");
    for (var i = 0, all = results.length; i < all; i++) {
      var link = results[i];
      link.onclick = function(event) {
        event.preventDefault();

        var data_send = {
          "action": "open_result",
          "type": "new_tab",
          "url": this.href
        };

        var isOpenNewWindow = (event.metaKey == false && event.ctrlKey == false) && (event.which == 1);
        if (isOpenNewWindow) data_send.type = "new_window";
        chrome.runtime.sendMessage(data_send);
      };
    }
  }
}