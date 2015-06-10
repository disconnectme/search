//incognito mode
if(window.location.origin == "https://search.disconnect.me" || window.location.origin == "https://searchbeta.disconnect.me") {
  var normal_results = document.querySelector("#normal-results");
  if (normal_results != null) {
    var results = normal_results.getElementsByTagName("a");
    for (var i = 0, all = results.length; i < all; i++) {
      var link = results[i];
      link.onclick = function(event) {
        event.preventDefault();
        if (this.getAttribute("data-tab") == "new") {
          chrome.runtime.sendMessage({
            "action":"serp_result_tab",
            "source": this.href
          });
          this.setAttribute("data-tab", "");
        } else {
          chrome.runtime.sendMessage({
            "action":"serp_result",
            "source" : this.href
          });
        }
      }
    }
    
    // Ability to open results in new tab (Command + click) on osx / chrome
    document.onkeydown = function(evt) {
      evt = evt || window.event;
      // keyCode 91 - Left Command button Webkit
      // keyCode 93 - Right Command button Webkit
      if(evt.keyCode == 91 || evt.keyCode == 93) {
        for (var i = 0, all = results.length; i < all; i++) {
          var link = results[i];
          link.setAttribute("data-tab", "new");
        }
      }
    };

    document.onkeyup = function(evt) {
      evt = evt || window.event;
      if(evt.keyCode == 91 || evt.keyCode == 93) {
        for (var i = 0, all = results.length; i < all; i++) {
          var link = results[i];
          link.setAttribute("data-tab", "");
        }
      }
    };
  }
}