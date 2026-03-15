(function () {
  var existingScript = document.getElementById("extractCodeScript");
  if (existingScript) {
    existingScript.remove();
  }

  var getCodeScript = `
    var editor = window.ace && ace.edit("ace-editor");
    var userSolution = editor ? editor.getValue() : "";
    var existingNode = document.getElementById("extractedUserSolution");
    if (existingNode) {
      existingNode.remove();
    }
    var scriptInjectedElement = document.createElement("textarea");
    scriptInjectedElement.value = userSolution;
    scriptInjectedElement.setAttribute("id", "extractedUserSolution");
    scriptInjectedElement.setAttribute(
      "style",
      "position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;",
    );
    scriptInjectedElement.setAttribute("aria-hidden", "true");
    scriptInjectedElement.tabIndex = -1;
    document.body.appendChild(scriptInjectedElement);
  `;

  var extractCodeScript = document.createElement("script");
  extractCodeScript.id = "extractCodeScript";
  extractCodeScript.appendChild(document.createTextNode(getCodeScript));

  (document.body || document.head || document.documentElement).appendChild(
    extractCodeScript,
  );
})();
