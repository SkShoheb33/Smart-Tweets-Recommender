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
                client_transaction_id: capturedHeaders.client_transaction_id,
                google_api_key: request.googleApiKey // Add the API key here
            };
            
            cookies.forEach(cookie => {
                if (cookie.name === 'auth_token') config.auth_token = cookie.value;
                if (cookie.name === 'ct0') config.csrf_token = cookie.value;
                if (cookie.name === 'twid') config.twid = cookie.value;
                if (cookie.name === 'guest_id') config.guest_id = cookie.value;
                if (cookie.name === '__cf_bm') config.cf_bm_cookie = cookie.value;
            });
            
            // 2. Send POST request to our local server and read stream
            fetch('http://localhost:8000/run_agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                
                const reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() || ''; // Keep the last incomplete part in the buffer

                    for (const part of parts) {
                        if (part.startsWith('data: ')) {
                            try {
                                const dataStr = part.substring(6);
                                const parsedData = JSON.parse(dataStr);
                                
                                if (parsedData.error) {
                                    chrome.tabs.sendMessage(sender.tab.id, { 
                                        type: 'AGENT_ERROR', 
                                        error: parsedData.error 
                                    });
                                } else if (parsedData.status === 'Done') {
                                    chrome.tabs.sendMessage(sender.tab.id, { 
                                        type: 'AGENT_DONE', 
                                        data: parsedData.result 
                                    });
                                } else {
                                    // Send status update to content script
                                    chrome.tabs.sendMessage(sender.tab.id, { 
                                        type: 'AGENT_STATUS', 
                                        status: parsedData.status 
                                    });
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e, part);
                            }
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error running agent:', error);
                chrome.tabs.sendMessage(sender.tab.id, { 
                    type: 'AGENT_ERROR', 
                    error: error.message 
                });
            });
        });

        // Return true to indicate we will send a response asynchronously
        return true;
    } else if (request.action === 'analyze_post') {
        chrome.cookies.getAll({ url: "https://x.com" }, (cookies) => {
            const config = {
                user_agent: navigator.userAgent,
                auth_bearer: capturedHeaders.auth_bearer,
                client_transaction_id: capturedHeaders.client_transaction_id,
                google_api_key: request.googleApiKey,
                tweet_id: request.tweetId
            };
            
            cookies.forEach(cookie => {
                if (cookie.name === 'auth_token') config.auth_token = cookie.value;
                if (cookie.name === 'ct0') config.csrf_token = cookie.value;
                if (cookie.name === 'twid') config.twid = cookie.value;
                if (cookie.name === 'guest_id') config.guest_id = cookie.value;
                if (cookie.name === '__cf_bm') config.cf_bm_cookie = cookie.value;
            });
            
            fetch('http://localhost:8000/analyze_post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                
                const reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() || '';

                    for (const part of parts) {
                        if (part.startsWith('data: ')) {
                            try {
                                const parsedData = JSON.parse(part.substring(6));
                                
                                if (parsedData.error) {
                                    chrome.tabs.sendMessage(sender.tab.id, { 
                                        type: 'ANALYZE_ERROR', 
                                        error: parsedData.error 
                                    });
                                } else if (parsedData.status === 'Done') {
                                    chrome.tabs.sendMessage(sender.tab.id, { 
                                        type: 'ANALYZE_DONE', 
                                        data: parsedData.result 
                                    });
                                } else {
                                    chrome.tabs.sendMessage(sender.tab.id, { 
                                        type: 'ANALYZE_STATUS', 
                                        status: parsedData.status 
                                    });
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e, part);
                            }
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error running analysis:', error);
                chrome.tabs.sendMessage(sender.tab.id, { 
                    type: 'ANALYZE_ERROR', 
                    error: error.message 
                });
            });
        });
        return true;
    } else if (request.action === 'check_server') {
        fetch('http://localhost:8000', { method: 'OPTIONS' })
            .then(res => {
                sendResponse({ online: res.ok });
            })
            .catch(() => {
                sendResponse({ online: false });
            });
        return true;
    }
});