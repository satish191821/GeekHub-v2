let begin = false;

const deviceAuthHelp = document.getElementById("device_auth_help");
const deviceAuthCode = document.getElementById("device_auth_code");
const openDeviceVerification = document.getElementById(
  "open_device_verification",
);
const copyDeviceCodeButton = document.getElementById("copy_device_code");
const deviceAuthStatus = document.getElementById("device_auth_status");
const deviceAuthStatusText = document.getElementById("device_auth_status_text");
const deviceAuthStatusSpinner = document.getElementById(
  "device_auth_status_spinner",
);
const retryDeviceAuthButton = document.getElementById("retry_device_auth");
const cancelDeviceAuthButton = document.getElementById("cancel_device_auth");
const toggleDeviceAuthHelpButton = document.getElementById(
  "toggle_device_auth_help",
);
let isManualAuthHelpVisible = false;

const hideDeviceAuthPrompt = () => {
  if (deviceAuthHelp) {
    deviceAuthHelp.style.display = "none";
  }
  if (toggleDeviceAuthHelpButton) {
    toggleDeviceAuthHelpButton.style.display = "none";
    toggleDeviceAuthHelpButton.textContent = "Show manual code option";
  }
  isManualAuthHelpVisible = false;
};

const renderDeviceAuthPrompt = (authPromptData) => {
  const prompt = authPromptData && authPromptData.githubDeviceAuthPrompt;
  if (
    !prompt ||
    !prompt.userCode ||
    !prompt.verificationURL ||
    (prompt.expiresAt && Date.now() > prompt.expiresAt)
  ) {
    hideDeviceAuthPrompt();
    return;
  }

  if (deviceAuthCode) {
    deviceAuthCode.textContent = prompt.userCode;
  }
  if (openDeviceVerification) {
    openDeviceVerification.href = prompt.verificationURL;
  }
  const shouldShowFallback =
    isManualAuthHelpVisible || prompt.hasAutoVerificationURL === false;
  if (deviceAuthHelp) {
    deviceAuthHelp.style.display = shouldShowFallback ? "block" : "none";
  }
  if (toggleDeviceAuthHelpButton) {
    toggleDeviceAuthHelpButton.style.display = "inline-flex";
    toggleDeviceAuthHelpButton.textContent = shouldShowFallback
      ? "Hide manual code option"
      : "Show manual code option";
  }
};

const renderAuthStatus = (authStatusData) => {
  const statusData = authStatusData && authStatusData.githubDeviceAuthStatus;
  const message =
    statusData && statusData.message ? statusData.message : "Ready to connect.";

  if (deviceAuthStatusText) {
    deviceAuthStatusText.textContent = message;
  } else if (deviceAuthStatus) {
    deviceAuthStatus.textContent = message;
  }

  if (deviceAuthStatusSpinner) {
    const shouldSpin = statusData && statusData.state === "pending";
    deviceAuthStatusSpinner.style.display = shouldSpin
      ? "inline-block"
      : "none";
  }

  if (
    toggleDeviceAuthHelpButton &&
    (!statusData || statusData.state === "authorized")
  ) {
    toggleDeviceAuthHelpButton.style.display = "none";
  }

  if (retryDeviceAuthButton) {
    retryDeviceAuthButton.style.display =
      statusData && statusData.canRetry ? "inline-flex" : "none";
  }
  if (cancelDeviceAuthButton) {
    cancelDeviceAuthButton.style.display =
      statusData && statusData.canCancel ? "inline-flex" : "none";
  }
};

const refreshDeviceAuthUI = () => {
  chrome.storage.local.get(
    ["githubDeviceAuthPrompt", "githubDeviceAuthStatus"],
    (authData) => {
      renderDeviceAuthPrompt(authData);
      renderAuthStatus(authData);
    },
  );
};

const syncModeToggle = document.getElementById("sync_mode_toggle");
const syncModeLabel = document.getElementById("sync_mode_label");
const repoStructureSelect = document.getElementById("repo_structure_select");
const syncHistoryList = document.getElementById("sync_history_list");
const syncHistoryToggle = document.getElementById("sync_history_toggle");
const hamburgerToggleButton = document.getElementById("hamburger_toggle");
const hamburgerMenu = document.getElementById("hamburger_menu");
const resetAllButton = document.getElementById("reset_all_button");
const resetStatsButton = document.getElementById("reset_stats_button");
const toggleRecentButton = document.getElementById("toggle_recent_button");
const resetRecentButton = document.getElementById("reset_recent_button");
const commitMessageToggle = document.getElementById("commit_message_toggle");
const commitMessageBody = document.getElementById("commit_message_body");
const commitMessageTextarea = document.getElementById(
  "commit_message_textarea",
);
const commitMessageSave = document.getElementById("commit_message_save");
const commitMessageReset = document.getElementById("commit_message_reset");
const commitMessageToast = document.getElementById("commit_message_toast");
let isSyncHistoryExpanded = false;
let isCommitMessageOpen = false;
let isRecentPanelVisible = true;

const applyRecentPanelVisibility = (isVisible) => {
  isRecentPanelVisible = isVisible !== false;
  const syncHistoryPanel = document.getElementById("sync_history_panel");
  if (syncHistoryPanel) {
    syncHistoryPanel.style.display = isRecentPanelVisible ? "block" : "none";
  }
  if (toggleRecentButton) {
    toggleRecentButton.textContent = isRecentPanelVisible
      ? "Hide Recent"
      : "Show Recent";
  }
};

const showCommitMessageToast = (text) => {
  if (!commitMessageToast) return;
  commitMessageToast.textContent = text;
  commitMessageToast.style.display = "inline-flex";
  setTimeout(() => {
    if (commitMessageToast) {
      commitMessageToast.style.display = "none";
    }
  }, 1400);
};

const applySyncModeUI = (mode) => {
  const isAuto = mode === "auto";
  if (syncModeToggle) syncModeToggle.checked = isAuto;
  if (syncModeLabel) syncModeLabel.textContent = isAuto ? "Auto" : "Manual";
};

const renderSyncHistory = (historyData) => {
  if (!syncHistoryList) return;
  const history =
    historyData && Array.isArray(historyData.syncHistory)
      ? historyData.syncHistory
      : [];
  const collapsedLimit = 3;
  const expandedLimit = 10;
  const visibleLimit = isSyncHistoryExpanded ? expandedLimit : collapsedLimit;

  syncHistoryList.innerHTML = "";
  if (history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "No syncs";
    syncHistoryList.appendChild(emptyItem);
    if (syncHistoryToggle) {
      syncHistoryToggle.style.display = "none";
    }
    return;
  }

  history.slice(0, visibleLimit).forEach((entry) => {
    const item = document.createElement("li");
    const status = entry && entry.status ? entry.status : "unknown";
    const compactStatusMap = {
      success: "✓",
      skipped: "⏭",
      failed: "✕",
      duplicate: "⏭",
      updated: "↻",
      unknown: "•",
    };
    const compactStatus =
      compactStatusMap[status.toLowerCase()] || compactStatusMap.unknown;
    const problem =
      entry && entry.problemTitle ? entry.problemTitle : "Untitled";
    const time = entry && entry.time ? entry.time : "";
    item.textContent = `${compactStatus} ${problem}${time ? ` · ${time}` : ""}`;
    syncHistoryList.appendChild(item);
  });

  if (syncHistoryToggle) {
    const hasMore = history.length > collapsedLimit;
    syncHistoryToggle.style.display = hasMore ? "inline-flex" : "none";
    syncHistoryToggle.textContent = isSyncHistoryExpanded ? "Less" : "More";
  }
};

const renderCommitMessage = (data) => {
  const message =
    data && typeof data.customCommitMessage === "string"
      ? data.customCommitMessage
      : "";
  if (commitMessageTextarea) {
    commitMessageTextarea.value = message;
  }
};

const applyUserStatisticsToUI = (userStatistics) => {
  const stats = userStatistics || {};
  $("#successful_submissions").text(stats.solved || 0);
  $("#successful_submissions_basic").text(stats.basic || 0);
  $("#successful_submissions_easy").text(stats.easy || 0);
  $("#successful_submissions_medium").text(stats.medium || 0);
  $("#successful_submissions_hard").text(stats.hard || 0);
};

chrome.storage.local.get(["syncMode"], (syncModeData) => {
  const syncMode = syncModeData.syncMode === "auto" ? "auto" : "manual";
  if (syncModeData.syncMode !== "auto" && syncModeData.syncMode !== "manual") {
    chrome.storage.local.set({ syncMode: "manual" }, () => {});
  }
  applySyncModeUI(syncMode);
});

chrome.storage.local.get(["repoStructure"], (repoStructureData) => {
  const repoStructure =
    repoStructureData && repoStructureData.repoStructure === "problem-first"
      ? "problem-first"
      : "difficulty-first";
  if (repoStructureSelect) {
    repoStructureSelect.value = repoStructure;
  }
  if (
    !repoStructureData ||
    (repoStructureData.repoStructure !== "problem-first" &&
      repoStructureData.repoStructure !== "difficulty-first")
  ) {
    chrome.storage.local.set({ repoStructure: "difficulty-first" }, () => {});
  }
});

chrome.storage.local.get(["syncHistory"], (syncHistoryData) => {
  renderSyncHistory(syncHistoryData);
});

chrome.storage.local.get(["recentPanelVisible"], (data) => {
  const shouldShow =
    !data || typeof data.recentPanelVisible !== "boolean"
      ? true
      : data.recentPanelVisible;
  applyRecentPanelVisibility(shouldShow);
  if (!data || typeof data.recentPanelVisible !== "boolean") {
    chrome.storage.local.set({ recentPanelVisible: true }, () => {});
  }
});

if (syncModeToggle) {
  syncModeToggle.addEventListener("change", () => {
    const syncMode = syncModeToggle.checked ? "auto" : "manual";
    chrome.storage.local.set({ syncMode }, () => {
      applySyncModeUI(syncMode);
    });
  });
}

if (repoStructureSelect) {
  repoStructureSelect.addEventListener("change", () => {
    const repoStructure =
      repoStructureSelect.value === "problem-first"
        ? "problem-first"
        : "difficulty-first";
    chrome.storage.local.set({ repoStructure }, () => {});
  });
}

if (syncHistoryToggle) {
  syncHistoryToggle.addEventListener("click", () => {
    isSyncHistoryExpanded = !isSyncHistoryExpanded;
    chrome.storage.local.get(["syncHistory"], (syncHistoryData) => {
      renderSyncHistory(syncHistoryData);
    });
  });
}

if (toggleRecentButton) {
  toggleRecentButton.addEventListener("click", () => {
    const nextVisibility = !isRecentPanelVisible;
    applyRecentPanelVisibility(nextVisibility);
    chrome.storage.local.set({ recentPanelVisible: nextVisibility }, () => {});
    if (hamburgerMenu) {
      hamburgerMenu.style.display = "none";
    }
  });
}

if (resetRecentButton) {
  resetRecentButton.addEventListener("click", () => {
    const confirmed = window.confirm("Reset recent sync history?");
    if (!confirmed) return;
    isSyncHistoryExpanded = false;
    chrome.storage.local.set({ syncHistory: [] }, () => {
      renderSyncHistory({ syncHistory: [] });
      if (hamburgerMenu) {
        hamburgerMenu.style.display = "none";
      }
    });
  });
}

if (commitMessageToggle && commitMessageBody) {
  commitMessageToggle.addEventListener("click", () => {
    isCommitMessageOpen = !isCommitMessageOpen;
    commitMessageBody.style.display = isCommitMessageOpen ? "flex" : "none";
    document.body.classList.toggle("commit-message-open", isCommitMessageOpen);
    commitMessageToggle.classList.toggle("is-open", isCommitMessageOpen);
  });
}

if (commitMessageSave && commitMessageTextarea) {
  commitMessageSave.addEventListener("click", () => {
    const message = commitMessageTextarea.value.trim();
    chrome.storage.local.set({ customCommitMessage: message }, () => {});
    if (commitMessageBody) {
      isCommitMessageOpen = false;
      commitMessageBody.style.display = "none";
      document.body.classList.remove("commit-message-open");
      if (commitMessageToggle) {
        commitMessageToggle.classList.remove("is-open");
      }
    }
  });
}

if (commitMessageReset && commitMessageTextarea) {
  commitMessageReset.addEventListener("click", () => {
    commitMessageTextarea.value = "";
    chrome.storage.local.set({ customCommitMessage: "" }, () => {});
  });
}

if (hamburgerToggleButton && hamburgerMenu) {
  hamburgerToggleButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isVisible = hamburgerMenu.style.display === "block";
    hamburgerMenu.style.display = isVisible ? "none" : "block";
  });

  hamburgerMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    hamburgerMenu.style.display = "none";
  });
}

if (resetStatsButton) {
  resetStatsButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Reset solved counters (Basic, Easy, Medium, Hard) to 0?",
    );
    if (!confirmed) return;

    const resetStats = {
      solved: 0,
      school: 0,
      basic: 0,
      easy: 0,
      medium: 0,
      hard: 0,
    };

    chrome.storage.local.set({ userStatistics: resetStats }, () => {
      applyUserStatisticsToUI(resetStats);
      if (hamburgerMenu) {
        hamburgerMenu.style.display = "none";
      }
    });
  });
}

if (resetAllButton) {
  resetAllButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Reset everything? This will log you out, unlink repo, clear history, and restart setup.",
    );
    if (!confirmed) return;

    chrome.runtime.sendMessage({ type: "cancelGitHubDeviceAuth" }, () => {
      chrome.storage.local.clear(() => {
        window.location.reload();
      });
    });
  });
}

$("#authentication_button").on("click", () => {
  if (begin) {
    hideDeviceAuthPrompt();
    startGitHubOAuthProcess.githubOAuth();
    setTimeout(() => {
      refreshDeviceAuthUI();
    }, 600);
  }
});

if (retryDeviceAuthButton) {
  retryDeviceAuthButton.addEventListener("click", () => {
    if (begin) {
      startGitHubOAuthProcess.githubOAuth();
      setTimeout(() => {
        refreshDeviceAuthUI();
      }, 600);
    }
  });
}

if (cancelDeviceAuthButton) {
  cancelDeviceAuthButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "cancelGitHubDeviceAuth" }, () => {
      hideDeviceAuthPrompt();
      refreshDeviceAuthUI();
    });
  });
}

if (toggleDeviceAuthHelpButton) {
  toggleDeviceAuthHelpButton.addEventListener("click", () => {
    isManualAuthHelpVisible = !isManualAuthHelpVisible;
    refreshDeviceAuthUI();
  });
}

if (copyDeviceCodeButton) {
  copyDeviceCodeButton.addEventListener("click", async () => {
    const code = deviceAuthCode ? deviceAuthCode.textContent.trim() : "";
    if (!code || code === "----") return;

    try {
      await navigator.clipboard.writeText(code);
      copyDeviceCodeButton.textContent = "Copied";
      setTimeout(() => {
        copyDeviceCodeButton.textContent = "Copy code";
      }, 1200);
    } catch (error) {
      copyDeviceCodeButton.textContent = "Copy failed";
      setTimeout(() => {
        copyDeviceCodeButton.textContent = "Copy code";
      }, 1200);
    }
  });
}

$("#index_URL").attr("href", chrome.runtime.getURL("index.html"));

$("#link_repo_redirect").attr("href", chrome.runtime.getURL("index.html"));

const showAuthenticationPhase = () => {
  begin = true;
  $("#repo_row").attr("style", "display:none;");
  $("#authentication_phase").attr("style", "display:inherit;");
  $("#link_repo_phase").attr("style", "display:none;");
  $("#solve_and_push_phase").attr("style", "display:none;");
  if (deviceAuthStatusText) {
    deviceAuthStatusText.textContent = "Ready to connect.";
  } else if (deviceAuthStatus) {
    deviceAuthStatus.textContent = "Ready to connect.";
  }
  if (deviceAuthStatusSpinner) {
    deviceAuthStatusSpinner.style.display = "none";
  }
  refreshDeviceAuthUI();
};

const showLinkRepoPhase = () => {
  begin = false;
  $("#repo_row").attr("style", "display:none;");
  $("#authentication_phase").attr("style", "display:none;");
  $("#link_repo_phase").attr("style", "display:inherit;");
  $("#solve_and_push_phase").attr("style", "display:none;");
};

const showSolveAndPushPhase = (userStats) => {
  begin = false;
  $("#repo_row").attr("style", "display:flex;");
  $("#authentication_phase").attr("style", "display:none;");
  $("#link_repo_phase").attr("style", "display:none;");
  $("#solve_and_push_phase").attr("style", "display:inherit;");

  const userStatistics = userStats && userStats.userStatistics;
  if (userStatistics) {
    applyUserStatisticsToUI(userStatistics);
  }

  const gitHubLinkedRepository = userStats && userStats.github_LinkedRepository;
  if (gitHubLinkedRepository) {
    $("#repository_link").html(
      `<a target="blank" style="color: #104a8e !important;" href="https://github.com/${gitHubLinkedRepository}">${gitHubLinkedRepository}</a>`,
    );
  } else {
    $("#repository_link").text("-");
  }
};

const validateGitHubTokenInBackground = (accessToken) => {
  if (!accessToken) return;

  const gitHubAPIAuthURL = "https://api.github.com/user";
  const xhttp = new XMLHttpRequest();
  xhttp.addEventListener("readystatechange", function () {
    if (xhttp.readyState !== 4) return;
    if (xhttp.status === 401) {
      chrome.storage.local.set({ githubAccessToken: null }, () => {
        showAuthenticationPhase();
      });
    }
  });
  xhttp.open("GET", gitHubAPIAuthURL, true);
  xhttp.setRequestHeader("Authorization", `token ${accessToken}`);
  xhttp.send();
};

chrome.storage.local.get("githubAccessToken", (responseToken) => {
  const accessToken = responseToken.githubAccessToken;
  if (accessToken === null || accessToken === undefined) {
    showAuthenticationPhase();
  } else {
    chrome.storage.local.remove("githubDeviceAuthPrompt", () => {});
    chrome.storage.local.remove("githubDeviceAuthStatus", () => {});
    hideDeviceAuthPrompt();

    chrome.storage.local.get(
      [
        "current_phase",
        "userStatistics",
        "github_LinkedRepository",
        "customCommitMessage",
      ],
      (storageData) => {
        if (storageData && storageData.current_phase === "solve_and_push") {
          showSolveAndPushPhase(storageData);
        } else {
          showLinkRepoPhase();
        }
        renderCommitMessage(storageData);
      },
    );

    validateGitHubTokenInBackground(accessToken);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.githubDeviceAuthPrompt || changes.githubDeviceAuthStatus) {
    refreshDeviceAuthUI();
  }
  if (changes.syncHistory) {
    renderSyncHistory({ syncHistory: changes.syncHistory.newValue });
  }
  if (changes.userStatistics) {
    applyUserStatisticsToUI(changes.userStatistics.newValue);
  }
  if (changes.recentPanelVisible) {
    applyRecentPanelVisibility(changes.recentPanelVisible.newValue);
  }
  if (changes.customCommitMessage) {
    renderCommitMessage({
      customCommitMessage: changes.customCommitMessage.newValue,
    });
  }
});
