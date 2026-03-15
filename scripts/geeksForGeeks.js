(() => {
  if (window.__geekhubGfgInjected) return;
  window.__geekhubGfgInjected = true;

  const codeLanguage = {
    C: ".c",
    "C++": ".cpp",
    "C#": ".cs",
    Java: ".java",
    Python: ".py",
    Python3: ".py",
    JavaScript: ".js",
    Javascript: ".js",
  };

  let successfulSubmissionFlag = true;
  let extensionContextWarningShown = false;

  function isExtensionContextValid() {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  function showExtensionContextWarning() {
    if (extensionContextWarningShown) return;
    extensionContextWarningShown = true;

    const existingToast = document.getElementById(
      "gfg-to-github-context-toast",
    );
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "gfg-to-github-context-toast";
    toast.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "z-index:2147483647",
      "padding:10px 14px",
      "border-radius:8px",
      "font-size:13px",
      "font-weight:600",
      "color:#ffffff",
      "background:#b91c1c",
      "box-shadow:0 6px 18px rgba(0,0,0,0.25)",
      "max-width:360px",
      "line-height:1.4",
    ].join(";");
    toast.innerText =
      "GeekHub needs a page refresh after extension reload/update. Please refresh this tab.";
    document.body.appendChild(toast);
  }

  function safeRuntimeSendMessage(message, callback) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (typeof callback === "function") {
          callback(response);
        }
      });
    } catch (error) {
      // no-op: context may be invalidated during reload
    }
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (typeof callback === "function") {
          callback(result || {});
        }
      });
    } catch (error) {
      // no-op: context may be invalidated during reload
    }
  }

  function safeStorageSet(data, callback) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (typeof callback === "function") {
          callback();
        }
      });
    } catch (error) {
      // no-op: context may be invalidated during reload
    }
  }

  if (isExtensionContextValid()) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.type === "geekhubPing") {
        sendResponse({ active: true });
      }
    });
  }

  function normalizeDifficulty(problemDifficulty) {
    const difficultyText =
      typeof problemDifficulty === "string" ? problemDifficulty.trim() : "";
    const lowerCaseDifficulty = difficultyText.toLowerCase();

    if (lowerCaseDifficulty.includes("school")) return "School";
    if (lowerCaseDifficulty.includes("basic")) return "Basic";
    if (lowerCaseDifficulty.includes("easy")) return "Easy";
    if (lowerCaseDifficulty.includes("medium")) return "Medium";
    if (lowerCaseDifficulty.includes("hard")) return "Hard";

    return difficultyText;
  }

  function getDifficultyBadgeHTML(problemDifficulty) {
    const normalizedDifficulty = normalizeDifficulty(problemDifficulty);

    const badgeColors = {
      School: "334155",
      Basic: "0ea5e9",
      Easy: "16a34a",
      Medium: "f97316",
      Hard: "dc2626",
    };

    const difficultyText = normalizedDifficulty || "Unknown";
    const difficultyColor = badgeColors[difficultyText] || "64748b";
    const badgeURL = `https://img.shields.io/badge/Difficulty-${encodeURIComponent(difficultyText)}-${difficultyColor}?style=flat&labelColor=111827`;

    return `<p><img src="${badgeURL}" alt="Difficulty ${difficultyText}" /></p>`;
  }

  function buildRepoFilePath(
    problemDifficulty,
    problemTitle,
    uploadFileName,
    repoStructure = "difficulty-first",
  ) {
    if (repoStructure === "problem-first") {
      return `${problemTitle}/${problemDifficulty}/${uploadFileName}`;
    }
    return `${problemDifficulty}/${problemTitle}/${uploadFileName}`;
  }

  function generateContentHash(content) {
    let hash = 0;
    const normalizedContent = typeof content === "string" ? content : "";
    for (let index = 0; index < normalizedContent.length; index += 1) {
      hash = (hash << 5) - hash + normalizedContent.charCodeAt(index);
      hash |= 0;
    }
    return `h_${Math.abs(hash)}`;
  }

  function buildCommitMessage(
    targetType,
    problemTitle,
    language,
    syncMode,
    status = "updated",
    customCommitMessage = "",
  ) {
    const trimmedCustom =
      typeof customCommitMessage === "string" ? customCommitMessage.trim() : "";
    if (trimmedCustom) {
      return `GeekHub v2:- ${trimmedCustom}`;
    }
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
    const normalizedLanguage = language || "unknown";
    const normalizedMode = syncMode === "auto" ? "auto" : "manual";
    const normalizedStatus = status === "created" ? "Create" : "Update";
    return `GeekHub v2:- ${normalizedStatus} ${targetType}: ${problemTitle} [${normalizedLanguage}] (${normalizedMode}) @ ${timestamp}`;
  }

  function appendSyncHistory(problemTitle, status, details = "") {
    safeStorageGet("syncHistory", (historyData) => {
      const existingHistory = Array.isArray(historyData.syncHistory)
        ? historyData.syncHistory
        : [];
      const entry = {
        problemTitle,
        status,
        details,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const updatedHistory = [entry, ...existingHistory].slice(0, 20);
      safeStorageSet({ syncHistory: updatedHistory }, () => {});
    });
  }

  function getDefaultUserStatistics() {
    return {
      solved: 0,
      school: 0,
      basic: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      sha: {},
    };
  }

  function normalizeUserStatistics(value) {
    const defaults = getDefaultUserStatistics();
    const normalized =
      value && typeof value === "object" ? { ...defaults, ...value } : defaults;

    if (!normalized.sha || typeof normalized.sha !== "object") {
      normalized.sha = {};
    }

    return normalized;
  }

  const uploadToGitHubRepository = (
    githubAccessToken,
    linkedRepository,
    solution,
    problemTitle,
    uploadFileName,
    sha,
    commitMessage,
    problemDifficulty,
    repoStructure,
    onComplete,
    retryCount = 0,
  ) => {
    const repoFilePath = buildRepoFilePath(
      problemDifficulty,
      problemTitle,
      uploadFileName,
      repoStructure,
    );
    const uploadPathURL = `https://api.github.com/repos/${linkedRepository}/contents/${repoFilePath}`;

    let uploadData = {
      message: commitMessage,
      content: solution,
      sha,
    };

    uploadData = JSON.stringify(uploadData);

    const xhttp = new XMLHttpRequest();
    xhttp.addEventListener("readystatechange", function () {
      if (xhttp.readyState === 4) {
        if (xhttp.status === 200 || xhttp.status === 201) {
          try {
            const updatedSha = JSON.parse(xhttp.responseText).content.sha;

            safeStorageGet("userStatistics", (statistics) => {
              const userStatistics = normalizeUserStatistics(
                statistics.userStatistics,
              );
              const githubFilePath = repoFilePath;
              const legacyGithubFilePath = problemTitle + uploadFileName;
              const normalizedDifficulty =
                normalizeDifficulty(problemDifficulty);

              if (uploadFileName === "README.md" && sha === null) {
                userStatistics.solved += 1;
                userStatistics.school +=
                  normalizedDifficulty === "School" ? 1 : 0;
                userStatistics.basic +=
                  normalizedDifficulty === "Basic" ? 1 : 0;
                userStatistics.easy += normalizedDifficulty === "Easy" ? 1 : 0;
                userStatistics.medium +=
                  normalizedDifficulty === "Medium" ? 1 : 0;
                userStatistics.hard += normalizedDifficulty === "Hard" ? 1 : 0;
              }
              userStatistics.sha[githubFilePath] = updatedSha;
              if (userStatistics.sha[legacyGithubFilePath] !== undefined) {
                delete userStatistics.sha[legacyGithubFilePath];
              }
              safeStorageSet({ userStatistics }, () => {
                console.log(`${uploadFileName} - Commit Successful`);
                if (typeof onComplete === "function") {
                  onComplete({
                    success: true,
                    uploadFileName,
                    status: xhttp.status,
                  });
                }
              });
            });
          } catch (error) {
            if (typeof onComplete === "function") {
              onComplete({
                success: false,
                uploadFileName,
                status: xhttp.status,
                error: "Failed to parse GitHub success response",
              });
            }
          }
        } else if (typeof onComplete === "function") {
          let errorMessage = `GitHub API error (${xhttp.status})`;
          try {
            const response = JSON.parse(xhttp.responseText);
            if (response && response.message) {
              errorMessage = response.message;
            }
          } catch (error) {
            errorMessage = xhttp.responseText || errorMessage;
          }

          const rateLimitHeader = xhttp.getResponseHeader(
            "x-ratelimit-remaining",
          );
          const isRateLimited =
            xhttp.status === 403 &&
            (rateLimitHeader === "0" ||
              /rate limit|secondary rate limit/i.test(errorMessage));

          if (isRateLimited && retryCount < 2) {
            const retryDelayMs = (retryCount + 1) * 3000;
            setTimeout(() => {
              uploadToGitHubRepository(
                githubAccessToken,
                linkedRepository,
                solution,
                problemTitle,
                uploadFileName,
                sha,
                commitMessage,
                problemDifficulty,
                repoStructure,
                onComplete,
                retryCount + 1,
              );
            }, retryDelayMs);
            return;
          }

          const isConflict = xhttp.status === 409;
          if (isConflict && retryCount < 1) {
            getRemoteFileSha(
              githubAccessToken,
              linkedRepository,
              problemTitle,
              uploadFileName,
              problemDifficulty,
              repoStructure,
              (freshSha) => {
                uploadToGitHubRepository(
                  githubAccessToken,
                  linkedRepository,
                  solution,
                  problemTitle,
                  uploadFileName,
                  freshSha,
                  commitMessage,
                  problemDifficulty,
                  repoStructure,
                  onComplete,
                  retryCount + 1,
                );
              },
            );
            return;
          }

          onComplete({
            success: false,
            uploadFileName,
            status: xhttp.status,
            error: errorMessage,
          });
        }
      }
    });
    xhttp.open("PUT", uploadPathURL, true);
    xhttp.setRequestHeader("Authorization", `token ${githubAccessToken}`);
    xhttp.setRequestHeader("Accept", "application/vnd.github.v3+json");
    xhttp.send(uploadData);
  };

  const getRemoteFileSha = (
    githubAccessToken,
    linkedRepository,
    problemTitle,
    uploadFileName,
    problemDifficulty,
    repoStructure,
    callback,
  ) => {
    const repoFilePath = buildRepoFilePath(
      problemDifficulty,
      problemTitle,
      uploadFileName,
      repoStructure,
    );
    const remoteFileURL = `https://api.github.com/repos/${linkedRepository}/contents/${repoFilePath}`;

    const xhttp = new XMLHttpRequest();
    xhttp.addEventListener("readystatechange", function () {
      if (xhttp.readyState === 4) {
        if (xhttp.status === 200) {
          try {
            const response = JSON.parse(xhttp.responseText);
            callback(response.sha || null);
          } catch (error) {
            callback(null);
          }
        } else {
          callback(null);
        }
      }
    });
    xhttp.open("GET", remoteFileURL, true);
    xhttp.setRequestHeader("Authorization", `token ${githubAccessToken}`);
    xhttp.setRequestHeader("Accept", "application/vnd.github.v3+json");
    xhttp.send();
  };

  function uploadGitHub(
    solution,
    problemName,
    uploadFileName,
    commitMessage,
    problemDifficulty = undefined,
    repoStructure = "difficulty-first",
    onComplete,
  ) {
    const difficulty = normalizeDifficulty(problemDifficulty);

    safeStorageGet("githubAccessToken", (access_token) => {
      const accessToken = access_token.githubAccessToken;
      if (accessToken) {
        safeStorageGet("current_phase", (phase) => {
          const currentPhase = phase.current_phase;
          if (currentPhase === "solve_and_push") {
            safeStorageGet("github_LinkedRepository", (linkedRepo) => {
              const linkedRepository = linkedRepo.github_LinkedRepository;
              if (linkedRepository) {
                const githubFilePath = buildRepoFilePath(
                  difficulty,
                  problemName,
                  uploadFileName,
                  repoStructure,
                );
                const legacyGithubFilePath = problemName + uploadFileName;
                safeStorageGet("userStatistics", (statistics) => {
                  const userStatistics = normalizeUserStatistics(
                    statistics.userStatistics,
                  );
                  let sha = null;

                  if (userStatistics.sha[githubFilePath] !== undefined) {
                    sha = userStatistics.sha[githubFilePath];
                  } else if (
                    userStatistics.sha[legacyGithubFilePath] !== undefined
                  ) {
                    sha = userStatistics.sha[legacyGithubFilePath];
                  }
                  if (sha !== null) {
                    uploadToGitHubRepository(
                      accessToken,
                      linkedRepository,
                      solution,
                      problemName,
                      uploadFileName,
                      sha,
                      commitMessage,
                      difficulty,
                      repoStructure,
                      onComplete,
                    );
                  } else {
                    getRemoteFileSha(
                      accessToken,
                      linkedRepository,
                      problemName,
                      uploadFileName,
                      difficulty,
                      repoStructure,
                      (remoteSha) => {
                        uploadToGitHubRepository(
                          accessToken,
                          linkedRepository,
                          solution,
                          problemName,
                          uploadFileName,
                          remoteSha,
                          commitMessage,
                          difficulty,
                          repoStructure,
                          onComplete,
                        );
                      },
                    );
                  }
                });
              } else if (typeof onComplete === "function") {
                onComplete({
                  success: false,
                  uploadFileName,
                  status: 400,
                  error: "No linked GitHub repository",
                });
              }
            });
          } else if (typeof onComplete === "function") {
            onComplete({
              success: false,
              uploadFileName,
              status: 400,
              error: "Extension is not in solve_and_push phase",
            });
          }
        });
      } else if (typeof onComplete === "function") {
        onComplete({
          success: false,
          uploadFileName,
          status: 401,
          error: "Missing GitHub access token",
        });
      }
    });
  }

  function showSyncToast(message, type = "info") {
    const existingToast = document.getElementById("gfg-to-github-sync-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "gfg-to-github-sync-toast";
    const backgroundColor =
      type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#1d4ed8";

    toast.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "z-index:2147483647",
      "padding:10px 14px",
      "border-radius:8px",
      "font-size:13px",
      "font-weight:600",
      "color:#ffffff",
      `background:${backgroundColor}`,
      "box-shadow:0 6px 18px rgba(0,0,0,0.25)",
      "max-width:360px",
      "line-height:1.4",
    ].join(";");
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3200);
  }

  function performSync(pendingData, onDone) {
    if (!isExtensionContextValid()) {
      showExtensionContextWarning();
      if (typeof onDone === "function") {
        onDone({ hasError: true, uploadResults: [] });
      }
      return;
    }

    const {
      probName,
      problemStatement,
      problemDifficulty,
      solutionLanguage,
      solution,
      syncMode,
    } = pendingData;

    safeStorageGet(
      [
        "repoStructure",
        "syncFileHashes",
        "github_LinkedRepository",
        "customCommitMessage",
      ],
      (storageData) => {
        const repoStructure =
          storageData && storageData.repoStructure === "problem-first"
            ? "problem-first"
            : "difficulty-first";
        const linkedRepository = storageData.github_LinkedRepository || "";
        const syncFileHashes =
          storageData && storageData.syncFileHashes
            ? storageData.syncFileHashes
            : {};
        const customCommitMessage =
          storageData && typeof storageData.customCommitMessage === "string"
            ? storageData.customCommitMessage
            : "";

        const targets = [
          {
            uploadFileName: "README.md",
            targetType: "README",
            plainContent: problemStatement,
            encodedContent: btoa(
              unescape(encodeURIComponent(problemStatement)),
            ),
          },
        ];

        if (solution !== "") {
          targets.push({
            uploadFileName: convertToKebabCase(probName + solutionLanguage),
            targetType: "Solution",
            plainContent: solution,
            encodedContent: btoa(unescape(encodeURIComponent(solution))),
          });
        } else {
          console.warn("GeekHub : No solution content to sync.");
        }

        let remainingUploads = targets.length;
        const uploadResults = [];

        const finalizeSync = () => {
          const hasError = uploadResults.some((entry) => !entry.success);
          const skippedCount = uploadResults.filter(
            (entry) => entry.skipped,
          ).length;
          const allSkipped =
            uploadResults.length > 0 && skippedCount === uploadResults.length;

          if (hasError) {
            appendSyncHistory(probName, "failed", "One or more uploads failed");
          } else if (allSkipped) {
            appendSyncHistory(probName, "skipped", "No changes detected");
          } else {
            appendSyncHistory(probName, "success", "Synced to GitHub");
          }

          safeStorageSet({ syncFileHashes }, () => {
            if (typeof onDone === "function") {
              onDone({ hasError, uploadResults, skippedCount, allSkipped });
            }
          });
        };

        const handleUploadResult = (result) => {
          const normalizedResult =
            result && typeof result === "object"
              ? result
              : {
                  success: false,
                  uploadFileName: "unknown",
                  error: "Upload callback returned invalid result",
                };
          uploadResults.push(normalizedResult);
          remainingUploads -= 1;
          if (remainingUploads === 0) {
            finalizeSync();
          }
        };

        targets.forEach((target) => {
          const repoFilePath = buildRepoFilePath(
            problemDifficulty,
            probName,
            target.uploadFileName,
            repoStructure,
          );
          const hashKey = `${linkedRepository}:${repoFilePath}`;
          const contentHash = generateContentHash(target.plainContent);

          if (
            syncFileHashes[hashKey] &&
            syncFileHashes[hashKey] === contentHash
          ) {
            handleUploadResult({
              success: true,
              skipped: true,
              uploadFileName: target.uploadFileName,
              message: "No content change",
            });
            return;
          }

          const commitMessage = buildCommitMessage(
            target.targetType,
            probName,
            solutionLanguage,
            syncMode,
            "updated",
            customCommitMessage,
          );

          uploadGitHub(
            target.encodedContent,
            probName,
            target.uploadFileName,
            commitMessage,
            problemDifficulty,
            repoStructure,
            (result) => {
              if (result && result.success) {
                syncFileHashes[hashKey] = contentHash;
              }
              handleUploadResult(result);
            },
          );
        });
      },
    );
  }

  const convertToKebabCase = (uploadFileName) => {
    return uploadFileName
      .replace(/[^a-zA-Z0-9\. ]/g, "")
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  };

  function getSolutionLanguage() {
    const languageNode = document.getElementsByClassName("divider text")[0];
    const languageText =
      languageNode && typeof languageNode.innerText === "string"
        ? languageNode.innerText
        : "";
    const lang = languageText.split("(")[0].trim();
    if (lang.length > 0 && codeLanguage[lang]) {
      return codeLanguage[lang];
    }
    return "";
  }

  function getProblemTitle() {
    const titleNode = document.querySelector(
      '[class^="problems_header_content__title"] > h3',
    );
    if (titleNode && typeof titleNode.innerText === "string") {
      return titleNode.innerText;
    }
    return "";
  }

  function getProblemDifficulty() {
    const difficultyNodes = document.querySelectorAll(
      '[class^="problems_header_description"]',
    );
    const difficultyNode =
      difficultyNodes && difficultyNodes[0] && difficultyNodes[0].children
        ? difficultyNodes[0].children[0]
        : null;
    if (difficultyNode && typeof difficultyNode.innerText === "string") {
      return normalizeDifficulty(difficultyNode.innerText);
    }
    return "";
  }

  function getProblemStatement() {
    const problemStatementElement = document.querySelector(
      '[class^="problems_problem_content"]',
    );
    if (!problemStatementElement) {
      return "";
    }
    return `${problemStatementElement.outerHTML}`;
  }

  function getCompanyAndTopicTags(problemStatement) {
    let tagHeading = document.querySelectorAll(
      ".problems_tag_container__kWANg",
    );
    let tagContent = document.querySelectorAll(".content");

    for (let i = 0; i < tagHeading.length; i++) {
      if (tagHeading[i].innerText === "Company Tags") {
        tagContent[i].classList.add("active");
        problemStatement = problemStatement.concat(
          "<p><span style=font-size:18px><strong>Company Tags : </strong><br>",
        );
        let numOfTags = tagContent[i].childNodes[0].children.length;
        for (let j = 0; j < numOfTags; j++) {
          if (tagContent[i].childNodes[0].children[j].innerText !== null) {
            const company = tagContent[i].childNodes[0].children[j].innerText;
            problemStatement = problemStatement.concat(
              "<code>" + company + "</code>&nbsp;",
            );
          }
        }
        tagContent[i].classList.remove("active");
      } else if (tagHeading[i].innerText === "Topic Tags") {
        tagContent[i].classList.add("active");
        problemStatement = problemStatement.concat(
          "<br><p><span style=font-size:18px><strong>Topic Tags : </strong><br>",
        );
        let numOfTags = tagContent[i].childNodes[0].children.length;
        for (let j = 0; j < numOfTags; j++) {
          if (tagContent[i].childNodes[0].children[j].innerText !== null) {
            const company = tagContent[i].childNodes[0].children[j].innerText;
            problemStatement = problemStatement.concat(
              "<code>" + company + "</code>&nbsp;",
            );
          }
        }
        tagContent[i].classList.remove("active");
      }
    }
    return problemStatement;
  }

  function injectSyncButton(pendingData) {
    const existingBtn = document.getElementById("gfg-to-github-sync-btn");
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement("button");
    btn.id = "gfg-to-github-sync-btn";
    btn.innerText = "\u2B06 Sync with GitHub";
    btn.style.cssText = [
      "background:linear-gradient(135deg,#f97316,#ea580c)",
      "color:#fff",
      "border:none",
      "border-radius:8px",
      "padding:8px 18px",
      "font-size:13px",
      "font-weight:700",
      "cursor:pointer",
      "margin:0 0 0 10px",
      "letter-spacing:0.4px",
      "box-shadow:0 2px 8px rgba(249,115,22,0.45)",
      "transition:opacity 0.2s",
      "z-index:9999",
      "position:relative",
      "vertical-align:middle",
    ].join(";");

    btn.addEventListener("mouseover", () => {
      btn.style.opacity = "0.85";
    });
    btn.addEventListener("mouseout", () => {
      btn.style.opacity = "1";
    });

    btn.addEventListener("click", function () {
      btn.innerText = "Syncing...";
      btn.disabled = true;
      btn.style.opacity = "0.65";
      btn.style.cursor = "not-allowed";

      performSync(
        {
          ...pendingData,
          syncMode: "manual",
        },
        ({ hasError, uploadResults, allSkipped }) => {
          if (hasError) {
            const failedResult = uploadResults.find((entry) => !entry.success);
            btn.innerText = "Sync Failed";
            btn.style.background = "linear-gradient(135deg,#ef4444,#dc2626)";
            btn.style.opacity = "1";
            btn.style.boxShadow = "0 2px 8px rgba(220,38,38,0.4)";
            showSyncToast(
              `Sync failed: ${failedResult && failedResult.error ? failedResult.error : "Unknown error"}`,
              "error",
            );
            setTimeout(() => {
              btn.innerText = "\u2B06 Sync with GitHub";
              btn.disabled = false;
              btn.style.background = "linear-gradient(135deg,#f97316,#ea580c)";
              btn.style.cursor = "pointer";
              btn.style.boxShadow = "0 2px 8px rgba(249,115,22,0.45)";
            }, 2000);
          } else {
            if (allSkipped) {
              btn.innerText = "Already Synced";
              btn.style.background = "linear-gradient(135deg,#64748b,#475569)";
              btn.style.opacity = "1";
              btn.style.boxShadow = "0 2px 8px rgba(71,85,105,0.4)";
              showSyncToast("No changes detected. Nothing to upload.", "info");
            } else {
              btn.innerText = "\u2713 Synced to GitHub!";
              btn.style.background = "linear-gradient(135deg,#22c55e,#16a34a)";
              btn.style.opacity = "1";
              btn.style.boxShadow = "0 2px 8px rgba(34,197,94,0.4)";
              showSyncToast("Sync completed successfully.", "success");
            }
          }
        },
      );
    });

    // Inject next to the GfG submit button
    const submitBtn = document.querySelector(
      '[class^="ui button problems_submit_button"]',
    );
    if (submitBtn && submitBtn.parentNode) {
      submitBtn.insertAdjacentElement("afterend", btn);
    } else {
      // Fallback: append to header actions area
      const actionsArea = document.querySelector(
        '[class^="problems_header_menu"]',
      );
      if (actionsArea) actionsArea.appendChild(btn);
    }
  }

  const loader = setInterval(() => {
    if (!isExtensionContextValid()) {
      showExtensionContextWarning();
      clearInterval(loader);
      return;
    }

    let problemTitle = null;
    let problemStatement = null;
    let problemDifficulty = null;
    let solutionLanguage = null;
    let solution = null;

    if (
      window.location.href.includes("www.geeksforgeeks.org/problems") ||
      window.location.href.includes("practice.geeksforgeeks.org/problems")
    ) {
      const gfgSubmitButton = document.querySelector(
        '[class^="ui button problems_submit_button"]',
      );
      if (!gfgSubmitButton || gfgSubmitButton.dataset.gfgToGithubListener)
        return;
      gfgSubmitButton.dataset.gfgToGithubListener = "true";

      gfgSubmitButton.addEventListener("click", function () {
        if (!isExtensionContextValid()) {
          return;
        }

        const headerMenu = document.querySelector(
          ".problems_header_menu__items__BUrou",
        );
        if (headerMenu && typeof headerMenu.click === "function") {
          headerMenu.click();
        }
        successfulSubmissionFlag = true;

        const submissionLoader = setInterval(() => {
          if (!isExtensionContextValid()) {
            clearInterval(submissionLoader);
            return;
          }

          const contentNodes = document.querySelectorAll(
            '[class^="problems_content"]',
          );
          if (!contentNodes || !contentNodes[0]) {
            return;
          }
          const submissionResult = contentNodes[0].innerText;
          if (
            (submissionResult.includes("Problem Solved Successfully") ||
              submissionResult.includes("Correct Answer")) &&
            successfulSubmissionFlag
          ) {
            successfulSubmissionFlag = false;
            clearInterval(submissionLoader);
            if (headerMenu && typeof headerMenu.click === "function") {
              headerMenu.click();
            }
            problemTitle = getProblemTitle().trim();
            problemDifficulty = getProblemDifficulty();
            problemStatement = getProblemStatement();
            solutionLanguage = getSolutionLanguage();
            console.log("Initialised Upload Variables");

            const probName = `${problemTitle}`;
            var questionUrl = window.location.href;
            const difficultyBadgeHTML =
              getDifficultyBadgeHTML(problemDifficulty);
            problemStatement = `<h2><a href="${questionUrl}">${problemTitle}</a></h2>${difficultyBadgeHTML}<hr>${problemStatement}`;
            problemStatement = getCompanyAndTopicTags(problemStatement);

            safeRuntimeSendMessage({ type: "getUserSolution" }, function () {
              console.log("getUserSolution - Message Sent.");
              setTimeout(function () {
                const extractedSolutionNode = document.getElementById(
                  "extractedUserSolution",
                );
                solution =
                  extractedSolutionNode &&
                  typeof extractedSolutionNode.value === "string"
                    ? extractedSolutionNode.value
                    : extractedSolutionNode &&
                        typeof extractedSolutionNode.textContent === "string"
                      ? extractedSolutionNode.textContent
                      : "";

                if (solution === "") {
                  console.warn(
                    "GeekHub: Solution extraction returned empty. Button will still appear.",
                  );
                }

                const pendingData = {
                  probName,
                  problemStatement,
                  problemDifficulty,
                  solutionLanguage,
                  solution,
                };

                safeStorageGet("syncMode", (syncModeData) => {
                  const syncMode =
                    syncModeData && syncModeData.syncMode === "auto"
                      ? "auto"
                      : "manual";

                  if (syncMode === "auto") {
                    showSyncToast("Auto sync started...", "info");
                    performSync(
                      {
                        ...pendingData,
                        syncMode,
                      },
                      ({ hasError, uploadResults, allSkipped }) => {
                        if (hasError) {
                          const failedResult = uploadResults.find(
                            (entry) => !entry.success,
                          );
                          showSyncToast(
                            `Auto sync failed: ${failedResult && failedResult.error ? failedResult.error : "Unknown error"}`,
                            "error",
                          );
                        } else if (allSkipped) {
                          showSyncToast(
                            "Auto sync skipped (no changes).",
                            "info",
                          );
                        } else {
                          showSyncToast(
                            "Auto sync completed successfully.",
                            "success",
                          );
                        }
                      },
                    );
                  } else {
                    injectSyncButton(pendingData);
                  }
                });

                safeRuntimeSendMessage({ type: "deleteNode" }, function () {
                  console.log("deleteNode - Message Sent.");
                });
              }, 1000);
            });
          } else if (submissionResult.includes("Compilation Error")) {
            clearInterval(submissionLoader);
          } else if (
            !successfulSubmissionFlag &&
            (submissionResult.includes("Compilation Error") ||
              submissionResult.includes("Correct Answer"))
          ) {
            clearInterval(submissionLoader);
          }
        }, 1000);
      });
    }
  }, 1000);
})();
