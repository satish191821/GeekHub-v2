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
) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const normalizedLanguage = language || "unknown";
  const normalizedMode = syncMode === "auto" ? "auto" : "manual";
  const normalizedStatus = status === "created" ? "Create" : "Update";
  return `${normalizedStatus} ${targetType}: ${problemTitle} [${normalizedLanguage}] (${normalizedMode}) @ ${timestamp}`;
}

function assert(name, condition) {
  if (!condition) {
    throw new Error(`FAILED: ${name}`);
  }
  console.log(`PASS: ${name}`);
}

function runSmokeTests() {
  assert(
    "difficulty-first path",
    buildRepoFilePath("Medium", "3Sum", "solution.cpp", "difficulty-first") ===
      "Medium/3Sum/solution.cpp",
  );

  assert(
    "problem-first path",
    buildRepoFilePath("Medium", "3Sum", "solution.cpp", "problem-first") ===
      "3Sum/Medium/solution.cpp",
  );

  assert(
    "same content hash matches",
    generateContentHash("abc") === generateContentHash("abc"),
  );
  assert(
    "different content hash differs",
    generateContentHash("abc") !== generateContentHash("abcd"),
  );

  const commitMessage = buildCommitMessage(
    "Solution",
    "3Sum",
    "C++",
    "manual",
    "updated",
  );
  assert("commit message has problem", commitMessage.includes("3Sum"));
  assert("commit message has mode", commitMessage.includes("manual"));

  console.log("All smoke tests passed.");
}

if (typeof window !== "undefined") {
  window.runGeekHubSmokeTests = runSmokeTests;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildRepoFilePath,
    generateContentHash,
    buildCommitMessage,
    runSmokeTests,
  };
}
