(() => {
  if (window.__geekhubNodeDeletionInjected) return;
  window.__geekhubNodeDeletionInjected = true;

  const removeChildScript = `
	(function () {
		var extractedNode = document.getElementById("extractedUserSolution");
		if (extractedNode && extractedNode.parentNode) {
			extractedNode.parentNode.removeChild(extractedNode);
		}

		var extractScript = document.getElementById("extractCodeScript");
		if (extractScript && extractScript.parentNode) {
			extractScript.parentNode.removeChild(extractScript);
		}

		var cleanupScript = document.getElementById("deletionScript");
		if (cleanupScript && cleanupScript.parentNode) {
			cleanupScript.parentNode.removeChild(cleanupScript);
		}
	})();
`;

  var deleteScript = document.createElement("script");
  deleteScript.id = "deletionScript";
  deleteScript.appendChild(document.createTextNode(removeChildScript));

  (document.body || document.head || document.documentElement).appendChild(
    deleteScript,
  );
})();
