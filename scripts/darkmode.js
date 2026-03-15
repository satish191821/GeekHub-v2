const darkModeButton = document.getElementById("darkmode-button");

const applyDarkMode = (isDark) => {
  $("body").toggleClass("dark-mode", isDark);

  const githubLogo = isDark
    ? "./assets/github_white.png"
    : "./assets/github.png";
  $(".github_logo").attr("src", githubLogo);

  const mailLogo = isDark
    ? "./assets/mail_dark.png"
    : "./assets/mail_light.png";
  $("#mail_logo").attr("src", mailLogo);

  if (darkModeButton) {
    darkModeButton.textContent = isDark ? "☀️" : "🌙";
    darkModeButton.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  }
};

chrome.storage.local.get(["darkmodeFlag"], (darkmodeData) => {
  const isDarkByDefault =
    !darkmodeData || darkmodeData.darkmodeFlag === undefined;
  const isDark = isDarkByDefault || darkmodeData.darkmodeFlag === 1;

  if (isDarkByDefault) {
    chrome.storage.local.set({ darkmodeFlag: 1 });
  }

  applyDarkMode(isDark);
});

if (darkModeButton) {
  darkModeButton.addEventListener("click", () => {
    const isDark = !$("body").hasClass("dark-mode");
    applyDarkMode(isDark);
    chrome.storage.local.set({ darkmodeFlag: isDark ? 1 : 0 });
  });
}
