// Track conversations by tab title
let conversationsByTabTitle = {};

// Track requests with timestamps
const requestTimestamps = new Map();
const REQUEST_DEBOUNCE = 2000; // 2 seconds

function shouldProcessRequest(url) {
  const now = Date.now();
  const lastRequest = requestTimestamps.get(url);
  
  if (!lastRequest || (now - lastRequest) > REQUEST_DEBOUNCE) {
    requestTimestamps.set(url, now);
    
    for (const [storedUrl, timestamp] of requestTimestamps.entries()) {
      if (now - timestamp > REQUEST_DEBOUNCE) {
        requestTimestamps.delete(storedUrl);
      }
    }
    
    return true;
  }
  
  return false;
}

// Listen for conversation requests
browser.webRequest.onCompleted.addListener(
  async (details) => {
    if (!details.url.includes('chat_conversations/') 
        || details.url.includes('latest')
        || details.url.includes('/chat_message_warning')) {
      return;
    }

    if (!shouldProcessRequest(details.url)) {
      console.log('Skipping duplicate request:', details.url);
      return;
    }
    
    console.log('Processing conversation request:', details.url);

    browser.tabs.query({active: true, currentWindow: true}).then(async (tabs) => {
      if (!tabs[0]) return;
      
      const tabTitle = tabs[0].title || 'Untitled Tab';
      
      if (conversationsByTabTitle[tabTitle]?.url === details.url) {
        console.log('Skipping already processed conversation for tab:', tabTitle);
        return;
      }

      try {
        const response = await fetch(details.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const textData = await response.text();

        try {
          const jsonData = JSON.parse(textData);
          console.log('Conversation data fetched successfully');

          if (!isValidConversationData(jsonData)) {
            console.warn('Invalid conversation data structure, skipping');
            return;
          }

          conversationsByTabTitle[tabTitle] = {
            url: details.url,
            timestamp: new Date().toISOString(),
            data: jsonData
          };

          browser.storage.local.set(
            { conversationsByTabTitle: conversationsByTabTitle } 
          ).catch(error => console.error('Error storing conversations:', error));
        } catch (jsonError) {
          console.warn('Invalid JSON response, ignoring:', jsonError);
        }
      } catch (error) {
        console.error('Fetch error:', error);
      }
    });
  },
  { urls: ['<all_urls>'] }
);

// Listen for storage changes to clear in-memory cache
browser.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.conversationsByTabTitle && changes.conversationsByTabTitle.newValue === undefined) {
    conversationsByTabTitle = {};
    console.log('Cleared in-memory cache of conversations');
  }
});

// Helper function to validate conversation data structure
function isValidConversationData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const messages = data.chat_messages || data.conversation?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }
  return messages.every(message => 
    message && 
    typeof message === 'object' &&
    (typeof message.text === 'string' || typeof message.content === 'string') &&
    (typeof message.role === 'string' || typeof message.sender === 'string')
  );
}

// Clear cache when tabs are closed
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  browser.tabs.get(tabId).then((tab) => {
    const tabTitle = tab?.title || 'Untitled Tab';
    delete conversationsByTabTitle[tabTitle];
    console.log('Cleared cached conversation for closed tab:', tabTitle);
  }).catch(() => {});
});

// Periodic sync with browser.storage
setInterval(() => {
  browser.storage.local.get('conversationsByTabTitle').then((result) => {
    const storedData = result.conversationsByTabTitle || {};
    for (const [title, data] of Object.entries(storedData)) {
      if (!conversationsByTabTitle[title] || 
          new Date(data.timestamp) > new Date(conversationsByTabTitle[title].timestamp)) {
        conversationsByTabTitle[title] = data;
      }
    }
  });
}, 5 * 60 * 1000);

// Ensure the service worker stays active
browser.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});
