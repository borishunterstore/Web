const allowedIPs = ["188.66.32.27"];

async function checkIP(ip) {
    return allowedIPs.includes(ip);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                const userIP = data.ip;
                checkIP(userIP).then(isAllowed => {
                    if (!isAllowed) {
                        chrome.tabs.update(tabId, { url: "error.html" });
                    }
                });
            });
    }
});
