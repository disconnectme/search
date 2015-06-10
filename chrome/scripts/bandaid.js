function insert_group_disconnect() {
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  
   chrome[runtimeOrExtension].sendMessage({
      action: 'get_group_disconnect'
    }, function(group_id){
          var div_id = "disconnect_group_id";
          var elemDiv = document.createElement("div");

          elemDiv.id = div_id;
          elemDiv.innerText = group_id;
          elemDiv.style.display = "none";
          document.body.appendChild(elemDiv);
    });
}

insert_group_disconnect();