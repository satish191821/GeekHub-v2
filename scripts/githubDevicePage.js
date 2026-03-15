const GEEKHUB_HELPER_ID = "geekhub-device-code-helper";
const GEEKHUB_STATUS_ID = "geekhub-device-status";
const GEEKHUB_STATUS_SPINNER_ID = "geekhub-device-status-spinner";
const GEEKHUB_STATUS_STYLE_ID = "geekhub-device-status-style";
const GEEKHUB_STATE = {
  continueClicked: false,
  submitClicked: false,
  observer: null,
};

function triggerImmediateAuthPoll() {
  try {
    chrome.runtime.sendMessage({ type: "triggerGitHubDeviceAuthPoll" });
  } catch (error) {
    // Ignore when runtime context is unavailable.
  }
}

function createOrUpdateDeviceCodeHelper(code) {
  if (!code) return;

  let helper = document.getElementById(GEEKHUB_HELPER_ID);
  if (!helper) {
    helper = document.createElement("div");
    helper.id = GEEKHUB_HELPER_ID;
    helper.style.position = "fixed";
    helper.style.top = "12px";
    helper.style.right = "12px";
    helper.style.zIndex = "2147483647";
    helper.style.background = "#0f172a";
    helper.style.color = "#f8fafc";
    helper.style.border = "1px solid #334155";
    helper.style.borderRadius = "8px";
    helper.style.boxShadow = "0 8px 18px rgba(0,0,0,0.28)";
    helper.style.padding = "8px 10px";
    helper.style.display = "flex";
    helper.style.alignItems = "center";
    helper.style.gap = "8px";
    helper.style.fontFamily = "Inter, Segoe UI, Arial, sans-serif";
    helper.style.fontSize = "12px";

    const label = document.createElement("span");
    label.id = `${GEEKHUB_HELPER_ID}-label`;
    label.style.fontWeight = "700";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.style.border = "1px solid #475569";
    copyBtn.style.borderRadius = "6px";
    copyBtn.style.padding = "2px 8px";
    copyBtn.style.background = "#1e293b";
    copyBtn.style.color = "#e2e8f0";
    copyBtn.style.cursor = "pointer";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1200);
      } catch (error) {
        copyBtn.textContent = "Failed";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1200);
      }
    });

    helper.appendChild(label);
    helper.appendChild(copyBtn);
    document.body.appendChild(helper);
  }

  const label = document.getElementById(`${GEEKHUB_HELPER_ID}-label`);
  if (label) {
    label.textContent = `GeekHub code: ${code}`;
  }
}

function showDeviceStatus(message) {
  if (!message) return;

  let status = document.getElementById(GEEKHUB_STATUS_ID);
  if (!status) {
    status = document.createElement("div");
    status.id = GEEKHUB_STATUS_ID;
    status.style.position = "fixed";
    status.style.top = "16px";
    status.style.left = "50%";
    status.style.right = "auto";
    status.style.transform = "translateX(-50%)";
    status.style.zIndex = "2147483647";
    status.style.background = "#0f172a";
    status.style.color = "#f8fafc";
    status.style.border = "1px solid #334155";
    status.style.borderRadius = "8px";
    status.style.boxShadow = "0 8px 18px rgba(0,0,0,0.28)";
    status.style.padding = "6px 10px";
    status.style.fontFamily = "Inter, Segoe UI, Arial, sans-serif";
    status.style.fontSize = "14px";
    status.style.maxWidth = "360px";
    status.style.textAlign = "center";
    document.body.appendChild(status);
  }

  status.textContent = message;
}

function ensureDeviceStatusStyles() {
  if (document.getElementById(GEEKHUB_STATUS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GEEKHUB_STATUS_STYLE_ID;
  style.textContent =
    "@keyframes geekhub-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
  document.head.appendChild(style);
}

function showDeviceStatusCountdown(seconds = 5) {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(seconds, 1) : 5;

  showDeviceStatus("");
  ensureDeviceStatusStyles();

  const status = document.getElementById(GEEKHUB_STATUS_ID);
  if (!status) return;

  let spinner = document.getElementById(GEEKHUB_STATUS_SPINNER_ID);
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = GEEKHUB_STATUS_SPINNER_ID;
    spinner.style.marginTop = "6px";
    spinner.style.width = "20px";
    spinner.style.height = "20px";
    spinner.style.borderRadius = "999px";
    spinner.style.border = "3px solid rgba(16, 185, 129, 0.25)";
    spinner.style.borderTopColor = "#10b981";
    spinner.style.animation = "geekhub-spin 1.6s linear infinite";
    spinner.style.marginLeft = "auto";
    spinner.style.marginRight = "auto";
    status.appendChild(spinner);
  }

  setTimeout(
    () => {
      const activeStatus = document.getElementById(GEEKHUB_STATUS_ID);
      if (activeStatus && activeStatus.parentNode) {
        activeStatus.parentNode.removeChild(activeStatus);
      }
    },
    totalSeconds * 1000 + 1200,
  );
}

function clickContinueButton() {
  const buttons = Array.from(
    document.querySelectorAll("button, input[type='submit'], [role='button']"),
  );

  const continueButton = buttons.find((candidate) => {
    const text = (
      candidate.innerText ||
      candidate.value ||
      candidate.textContent ||
      ""
    )
      .trim()
      .toLowerCase();
    return text === "continue" && !candidate.disabled;
  });

  if (!continueButton) {
    return false;
  }

  continueButton.click();
  triggerImmediateAuthPoll();
  return true;
}

function fillSegmentedInputs(cleanCode) {
  const inputs = Array.from(
    document.querySelectorAll(
      "input[maxlength='1'], input[name^='user_code'], input[id*='user-code'], input[autocomplete='one-time-code'], input[type='text'], input[type='tel'], input[inputmode='numeric']",
    ),
  )
    .filter((input) => {
      const maxLength = Number(input.getAttribute("maxlength") || 0);
      const isSingleCharField =
        maxLength === 1 ||
        (input.getAttribute("name") || "").startsWith("user_code") ||
        (input.getAttribute("id") || "").includes("user-code");
      const isVisible =
        input.offsetParent !== null ||
        (input.getClientRects && input.getClientRects().length > 0);

      return (
        isSingleCharField && isVisible && !input.disabled && !input.readOnly
      );
    })
    .sort((first, second) => {
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      if (Math.abs(firstRect.top - secondRect.top) > 4) {
        return firstRect.top - secondRect.top;
      }
      return firstRect.left - secondRect.left;
    });

  if (inputs.length < cleanCode.length) {
    return false;
  }

  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  for (let index = 0; index < cleanCode.length; index += 1) {
    const input = inputs[index];
    if (!input) {
      return false;
    }

    input.focus();
    if (valueSetter) {
      valueSetter.call(input, cleanCode[index]);
    } else {
      input.value = cleanCode[index];
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return true;
}

function fillWholeCodeInput(code) {
  const selectors = [
    "input[name='user_code']",
    "input#user_code",
    "input[autocomplete='one-time-code']",
  ];

  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (!input || input.disabled || input.readOnly) {
      continue;
    }

    input.focus();
    input.value = code;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  return false;
}

function runDevicePageAutomation(code) {
  if (!code || !window.location.pathname.startsWith("/login/device")) {
    return;
  }

  const cleanCode = String(code).replace(/[^A-Za-z0-9]/g, "");
  const pageText = (document.body && document.body.innerText) || "";
  const isAccountStep =
    pageText.includes("Device Activation") ||
    pageText.includes("Use a different account");

  if (isAccountStep && !GEEKHUB_STATE.continueClicked) {
    GEEKHUB_STATE.continueClicked = clickContinueButton();
    if (GEEKHUB_STATE.continueClicked) {
      showDeviceStatusCountdown(5);
    }
  }

  const filled = fillWholeCodeInput(code) || fillSegmentedInputs(cleanCode);
  if (filled) {
    createOrUpdateDeviceCodeHelper(code);
    showDeviceStatusCountdown(5);
    triggerImmediateAuthPoll();
    if (!GEEKHUB_STATE.submitClicked) {
      GEEKHUB_STATE.submitClicked = true;
      setTimeout(() => {
        clickContinueButton();
      }, 300);
    }
  }
}

function syncDeviceCodeFromStorage() {
  chrome.storage.local.get(["githubDeviceAuthPrompt"], (data) => {
    const prompt = data && data.githubDeviceAuthPrompt;
    const userCode = prompt && prompt.userCode ? prompt.userCode : "";
    runDevicePageAutomation(userCode);
  });
}

if (window.location.pathname.startsWith("/login/device")) {
  syncDeviceCodeFromStorage();

  if (!GEEKHUB_STATE.observer) {
    GEEKHUB_STATE.observer = new MutationObserver(() => {
      syncDeviceCodeFromStorage();
    });
    GEEKHUB_STATE.observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.githubDeviceAuthPrompt) {
      return;
    }
    syncDeviceCodeFromStorage();
  });
}
