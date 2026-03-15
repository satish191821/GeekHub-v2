chrome.storage.local.get("darkmodeFlag", (darkmodeFlag) => {
  if (darkmodeFlag.darkmodeFlag === undefined) {
    chrome.storage.local.set({
      darkmodeFlag: 1,
    });
  }
});

const githubDeviceAuth = {
  OAuthClientID: "Ov23lio5lRsgDi0p0gNO",
  githubDeviceCodeURL: "https://github.com/login/device/code",
  githubAccessTokenURL: "https://github.com/login/oauth/access_token",
  githubUserAuthenticationURL: "https://api.github.com/user",
  alarmName: "github-device-auth-poll",
};
let isGitHubDevicePollInFlight = false;

const GFG_URL_PATTERNS = [
  "https://practice.geeksforgeeks.org/*",
  "https://www.geeksforgeeks.org/*",
];

function isGfgProblemUrl(url) {
  if (typeof url !== "string") return false;
  return (
    url.includes("practice.geeksforgeeks.org/problems") ||
    url.includes("www.geeksforgeeks.org/problems")
  );
}

function injectGfgContentScript(tabId) {
  if (typeof tabId !== "number") return;
  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ["scripts/geeksForGeeks.js"],
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore non-matching pages or transient tab states.
      }
    },
  );
}

function ensureGfgContentScript(tabId, url) {
  if (typeof tabId !== "number" || !isGfgProblemUrl(url)) return;

  chrome.tabs.sendMessage(tabId, { type: "geekhubPing" }, (response) => {
    const shouldInject =
      Boolean(chrome.runtime.lastError) ||
      !response ||
      response.active !== true;

    if (shouldInject) {
      injectGfgContentScript(tabId);
    }
  });
}

function ensureGfgContentScriptInOpenTabs() {
  chrome.tabs.query({ url: GFG_URL_PATTERNS }, (tabs) => {
    if (chrome.runtime.lastError || !Array.isArray(tabs)) {
      return;
    }

    tabs.forEach((tab) => {
      if (tab && typeof tab.id === "number" && isGfgProblemUrl(tab.url)) {
        ensureGfgContentScript(tab.id, tab.url);
      }
    });
  });
}

function normalizePollIntervalSeconds(value) {
  return typeof value === "number" && value > 0 ? value : 5;
}

function scheduleGitHubDevicePollFromTimestamp(nextPollAt) {
  const delayMs = Math.max((nextPollAt || Date.now()) - Date.now(), 1000);
  chrome.alarms.create(githubDeviceAuth.alarmName, {
    delayInMinutes: delayMs / 60000,
  });
}

function updateSessionPollWindow(session, intervalSeconds) {
  const normalizedInterval = normalizePollIntervalSeconds(intervalSeconds);
  const nextPollAt = Date.now() + normalizedInterval * 1000;
  const updatedSession = {
    ...session,
    intervalSeconds: normalizedInterval,
    nextPollAt,
  };

  chrome.storage.local.set({ githubDeviceAuthSession: updatedSession }, () => {
    scheduleGitHubDevicePollFromTimestamp(nextPollAt);
  });

  return updatedSession;
}

function setGitHubAuthStatus(
  state,
  message,
  canRetry = false,
  canCancel = false,
) {
  chrome.storage.local.set(
    {
      githubDeviceAuthStatus: {
        state,
        message,
        canRetry,
        canCancel,
        updatedAt: Date.now(),
      },
    },
    () => {},
  );
}

function scheduleGitHubDevicePoll(intervalSeconds) {
  const delayInMinutes = normalizePollIntervalSeconds(intervalSeconds) / 60;
  chrome.alarms.create(githubDeviceAuth.alarmName, { delayInMinutes });
}

async function requestGitHubDeviceCode() {
  const body = new URLSearchParams();
  body.append("client_id", githubDeviceAuth.OAuthClientID);
  body.append("scope", "repo");

  const response = await fetch(githubDeviceAuth.githubDeviceCodeURL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub device authorization request failed (${response.status})`,
    );
  }

  return response.json();
}

async function requestGitHubAccessToken(deviceCode) {
  const body = new URLSearchParams();
  body.append("client_id", githubDeviceAuth.OAuthClientID);
  body.append("device_code", deviceCode);
  body.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");

  const response = await fetch(githubDeviceAuth.githubAccessTokenURL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`GitHub token polling request failed (${response.status})`);
  }

  return response.json();
}

async function fetchGitHubUsername(accessToken) {
  const response = await fetch(githubDeviceAuth.githubUserAuthenticationURL, {
    method: "GET",
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to verify GitHub user (${response.status})`);
  }

  const data = await response.json();
  return data && data.login ? data.login : null;
}

function clearGitHubDeviceAuthState(keepStatus = false) {
  chrome.alarms.clear(githubDeviceAuth.alarmName);
  const keysToRemove = [
    "githubDeviceAuthPrompt",
    "githubDeviceAuthSession",
    "githubDeviceAuthTabId",
  ];
  if (!keepStatus) {
    keysToRemove.push("githubDeviceAuthStatus");
  }
  chrome.storage.local.remove(keysToRemove, () => {});
}

function openPostAuthSetupPage() {
  const indexURL = chrome.runtime.getURL("index.html");

  chrome.storage.local.get("githubDeviceAuthTabId", (authTabData) => {
    const authTabId = authTabData && authTabData.githubDeviceAuthTabId;

    if (typeof authTabId !== "number") {
      chrome.tabs.create({ url: indexURL, active: true });
      return;
    }

    chrome.tabs.update(authTabId, { url: indexURL, active: true }, () => {
      if (chrome.runtime.lastError) {
        chrome.tabs.create({ url: indexURL, active: true });
      }
    });
  });
}

async function completeGitHubAuthentication(accessToken) {
  const githubUsername = await fetchGitHubUsername(accessToken);
  if (!githubUsername) {
    throw new Error("Failed to fetch GitHub username");
  }

  chrome.storage.local.get("github_LinkedRepository", (repoData) => {
    const linkedRepository = repoData.github_LinkedRepository;
    const updatePayload = {
      githubUsername,
      githubAccessToken: accessToken,
    };

    if (!linkedRepository) {
      updatePayload.current_phase = "link_repo";
    }

    chrome.storage.local.set(updatePayload, () => {
      setGitHubAuthStatus(
        "authorized",
        "GitHub authentication completed.",
        false,
        false,
      );
      openPostAuthSetupPage();
      clearGitHubDeviceAuthState();
    });
  });
}

async function pollGitHubDeviceAuth() {
  if (isGitHubDevicePollInFlight) {
    return;
  }

  chrome.storage.local.get("githubDeviceAuthSession", async (sessionData) => {
    const session = sessionData.githubDeviceAuthSession;
    if (!session || !session.deviceCode) {
      clearGitHubDeviceAuthState();
      return;
    }

    if (Date.now() > session.expiresAt) {
      setGitHubAuthStatus(
        "timeout",
        "Authentication timed out. Please retry.",
        true,
        false,
      );
      clearGitHubDeviceAuthState(true);
      console.error("GitHub authentication timed out. Please try again.");
      return;
    }

    if (session.nextPollAt && Date.now() < session.nextPollAt) {
      scheduleGitHubDevicePollFromTimestamp(session.nextPollAt);
      return;
    }

    isGitHubDevicePollInFlight = true;
    try {
      const response = await requestGitHubAccessToken(session.deviceCode);

      if (response && response.access_token) {
        await completeGitHubAuthentication(response.access_token);
        return;
      }

      const errorCode = response && response.error ? response.error : null;

      if (errorCode === "authorization_pending") {
        const intervalSeconds = normalizePollIntervalSeconds(
          session.intervalSeconds,
        );
        updateSessionPollWindow(session, intervalSeconds);
        setGitHubAuthStatus(
          "pending",
          "Waiting for GitHub approval... After you approve, redirect may take a few seconds.",
          true,
          true,
        );
        return;
      }

      if (errorCode === "slow_down") {
        const updatedInterval =
          normalizePollIntervalSeconds(session.intervalSeconds) + 5;
        updateSessionPollWindow(session, updatedInterval);
        setGitHubAuthStatus(
          "pending",
          "Waiting for GitHub approval... After you approve, redirect may take a few seconds.",
          true,
          true,
        );
        return;
      }

      if (errorCode === "access_denied") {
        setGitHubAuthStatus(
          "error",
          "Authorization denied on GitHub.",
          true,
          false,
        );
        clearGitHubDeviceAuthState(true);
        console.error("GitHub authentication was denied.");
        return;
      }

      if (errorCode === "expired_token") {
        setGitHubAuthStatus(
          "error",
          "Device code expired. Please retry.",
          true,
          false,
        );
        clearGitHubDeviceAuthState(true);
        console.error("GitHub authentication expired. Please try again.");
        return;
      }

      setGitHubAuthStatus(
        "error",
        "Unexpected auth response. Please retry.",
        true,
        true,
      );

      updateSessionPollWindow(
        session,
        normalizePollIntervalSeconds(session.intervalSeconds),
      );
    } catch (error) {
      const errorMessage =
        error && error.message ? error.message.toLowerCase() : "";
      const isFetchFailure = errorMessage.includes("failed to fetch");
      setGitHubAuthStatus(
        "error",
        isFetchFailure
          ? "Cannot reach GitHub. Check your internet, VPN, or firewall. Retrying..."
          : "Network issue while waiting for approval. Retrying...",
        true,
        true,
      );
      console.error(
        error && error.message ? error.message : "GitHub auth poll failed",
      );
      const backoffSeconds = isFetchFailure
        ? normalizePollIntervalSeconds(session.intervalSeconds) + 10
        : normalizePollIntervalSeconds(session.intervalSeconds);
      updateSessionPollWindow(session, backoffSeconds);
    } finally {
      isGitHubDevicePollInFlight = false;
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === githubDeviceAuth.alarmName) {
    pollGitHubDeviceAuth();
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureGfgContentScriptInOpenTabs();
});

chrome.runtime.onInstalled.addListener(() => {
  ensureGfgContentScriptInOpenTabs();
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!activeInfo || typeof activeInfo.tabId !== "number") return;
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    ensureGfgContentScript(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo) return;
  const resolvedUrl = (tab && tab.url) || changeInfo.url;
  if (changeInfo.status === "complete" || typeof changeInfo.url === "string") {
    ensureGfgContentScript(tabId, resolvedUrl);
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request && request.type === "triggerGitHubDeviceAuthPoll") {
    pollGitHubDeviceAuth();
    sendResponse({ status: true });
    return;
  }

  if (request && request.type === "cancelGitHubDeviceAuth") {
    clearGitHubDeviceAuthState();
    setGitHubAuthStatus("cancelled", "Authentication cancelled.", true, false);
    sendResponse({ status: true });
    return;
  }

  if (request && request.type === "startGitHubDeviceAuth") {
    setGitHubAuthStatus(
      "pending",
      "Starting GitHub authentication...",
      true,
      true,
    );
    requestGitHubDeviceCode()
      .then((response) => {
        if (!response || !response.device_code) {
          setGitHubAuthStatus(
            "error",
            "Failed to initialize GitHub authentication.",
            true,
            false,
          );
          sendResponse({
            status: false,
            error: "Failed to initialize GitHub device authorization.",
          });
          return;
        }

        const verificationURL =
          response.verification_uri_complete ||
          response.verification_uri ||
          "https://github.com/login/device";
        const hasCompleteVerificationURL = Boolean(
          response.verification_uri_complete,
        );
        const promptUserCode = response.user_code || "";
        const intervalSeconds =
          typeof response.interval === "number" && response.interval > 0
            ? response.interval
            : 5;
        const expiresInSeconds =
          typeof response.expires_in === "number" && response.expires_in > 0
            ? response.expires_in
            : 900;
        const expiresAt = Date.now() + expiresInSeconds * 1000;

        chrome.storage.local.set(
          {
            githubDeviceAuthPrompt: {
              userCode: promptUserCode,
              verificationURL,
              hasAutoVerificationURL: hasCompleteVerificationURL,
              expiresAt,
            },
            githubDeviceAuthSession: {
              deviceCode: response.device_code,
              intervalSeconds,
              nextPollAt: Date.now(),
              expiresAt,
            },
          },
          () => {
            setGitHubAuthStatus(
              "pending",
              hasCompleteVerificationURL
                ? "Approve access on the opened GitHub tab. Redirect may take a few seconds after approval."
                : "Waiting for GitHub approval... Redirect may take a few seconds after approval.",
              true,
              true,
            );
            chrome.tabs.create(
              { url: verificationURL, active: true },
              (tab) => {
                if (tab && typeof tab.id === "number") {
                  chrome.storage.local.set(
                    { githubDeviceAuthTabId: tab.id },
                    () => {},
                  );
                }

                scheduleGitHubDevicePoll(intervalSeconds);
                pollGitHubDeviceAuth();
                sendResponse({ status: true });
              },
            );
          },
        );
      })
      .catch((error) => {
        setGitHubAuthStatus(
          "error",
          "Unable to contact GitHub. Please retry.",
          true,
          false,
        );
        sendResponse({
          status: false,
          error:
            error && error.message
              ? error.message
              : "GitHub device authorization request failed.",
        });
      });
    return true;
  }

  if (request.type == "getUserSolution") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ["scripts/extractCode.js"],
      world: "MAIN",
    });
    sendResponse({ status: true });
  }

  if (request.type == "deleteNode") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ["scripts/nodeDeletion.js"],
      world: "MAIN",
    });
    sendResponse({ status: true });
  }
});
