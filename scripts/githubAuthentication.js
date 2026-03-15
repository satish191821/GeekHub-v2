const startGitHubOAuthProcess = {
  init() {
    this.githubUserToken = "githubAccessToken";
  },

  githubOAuth() {
    this.init();
    chrome.runtime.sendMessage(
      { type: "startGitHubDeviceAuth" },
      (response) => {
        if (!response || response.status !== true) {
          console.error(
            response && response.error
              ? response.error
              : "Failed to start GitHub authentication.",
          );
        }
      },
    );
  },
};
