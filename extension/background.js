let capturedHeaders = {
    auth_bearer: null,
    client_transaction_id: null
};

// Listen to network requests on x.com to capture the authorization and client transaction ID headers
chrome.webRequest.onSendHeaders.addListener(
    (details) => {
        let auth = null;
        let ctid = null;
        
        for (let header of details.requestHeaders) {
            if (header.name.toLowerCase() === 'authorization') {
                auth = header.value;
            }
            if (header.name.toLowerCase() === 'x-client-transaction-id') {
                ctid = header.value;
            }
        }
        
        if (auth && auth.startsWith('Bearer ')) {
            capturedHeaders.auth_bearer = auth.replace('Bearer ', '');
        }
        if (ctid) {
            capturedHeaders.client_transaction_id = ctid;
        }
    },
    { urls: ["*://*.x.com/*", "*://*.twitter.com/*"] },
    ["requestHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetch_recommendations') {
        
        // 1. First, get the required cookies from x.com
        chrome.cookies.getAll({ url: "https://x.com" }, (cookies) => {
            const config = {
                user_agent: navigator.userAgent,
                auth_bearer: capturedHeaders.auth_bearer,
                client_transaction_id: capturedHeaders.client_transaction_id
            };
            
            cookies.forEach(cookie => {
                if (cookie.name === 'auth_token') config.auth_token = cookie.value;
                if (cookie.name === 'ct0') config.csrf_token = cookie.value;
                if (cookie.name === 'twid') config.twid = cookie.value;
                if (cookie.name === 'guest_id') config.guest_id = cookie.value;
                if (cookie.name === '__cf_bm') config.cf_bm_cookie = cookie.value;
            });
            
            // 2. Send POST request to our local server
            fetch('http://localhost:8000/run_agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                sendResponse({ data: data });
            })
            .catch(error => {
                console.error('Error running agent:', error);
                sendResponse({ error: error.message });
            });
        });

        // Return true to indicate we will send a response asynchronously
        return true;
    }
});