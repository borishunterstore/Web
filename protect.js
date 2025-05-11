chrome.runtime.sendMessage({ action: "checkIP" }, (response) => {
    if (!response.allowed) {
        window.location.href = chrome.runtime.getURL("error.html");
    }
});
