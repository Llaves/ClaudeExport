// Import shared HTML conversion script
importScripts('html-converter.js');

// Track conversations by tab title
let conversationsByTabTitle = {};

// Track requests with timestamps
const requestTimestamps = new Map();
const REQUEST_DEBOUNCE = 2000; // 2 seconds

function shouldProcessRequest(url) {
  const now = Date.now();
  const lastRequest = requestTimestamps.get(url);
  
  // If we've never seen this URL or it was more than 2 seconds ago
  if (!lastRequest || (now - lastRequest) > REQUEST_DEBOUNCE) {
    requestTimestamps.set(url, now);
    
    // Cleanup old entries
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
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    // Skip if not a conversation URL
    if (!details.url.includes('chat_conversations/') 
        || details.url.includes('latest')
        || details.url.includes('count')
        || details.url.includes('/chat_message_warning')) {
      return;
    }

    // Skip if we've seen this request recently
    if (!shouldProcessRequest(details.url)) {
      console.log('Skipping duplicate request:', details.url);
      return;
    }
    
    console.log('Processing conversation request:', details.url);

    // Get the active tab details
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (!tabs[0]) return;
      
      // Fetch the conversation
      try {
        const response = await fetch(details.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const textData = await response.text();

        try {
          const jsonData = JSON.parse(textData);
          console.log('Conversation data fetched successfully');

          // Verify this is actually a conversation data structure
          if (!isValidConversationData(jsonData)) {
            console.warn('Invalid conversation data structure, skipping');
            return;
          }

          // Use the conversation's name as the key for storage
          // Fallback to UUID or a generic name if 'name' is not available
          const conversationKey = jsonData.name || jsonData.uuid || 'Untitled Conversation';
          
          // Skip if we've already processed this exact URL for this conversation key
          if (conversationsByTabTitle[conversationKey]?.url === details.url) {
            console.log('Skipping already processed conversation for key:', conversationKey);
            return;
          }

          // Store the conversation data
          conversationsByTabTitle[conversationKey] = {
            url: details.url,
            timestamp: new Date().toISOString(),
            data: jsonData
          };

          // Store in chrome storage
          chrome.storage.local.set(
            { conversationsByTabTitle: conversationsByTabTitle }, 
            () => {
              if (chrome.runtime.lastError) {
                console.error('Error storing conversations:', chrome.runtime.lastError);
              } else {
                console.log('Conversations stored in local storage');
              }
            }
          );
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
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.conversationsByTabTitle && changes.conversationsByTabTitle.newValue === undefined) {
    conversationsByTabTitle = {};
    console.log('Cleared in-memory cache of conversations');
  }
});

// Helper function to validate conversation data structure
function isValidConversationData(data) {
  // First check if we have a valid object
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check for messages array either directly or in conversation object
  const messages = data.chat_messages || data.conversation?.chat_messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }

  // Verify that messages have required fields
  return messages.every(message => 
    message && 
    typeof message === 'object' &&
    (typeof message.text === 'string' || typeof message.content === 'string') &&
    (typeof message.role === 'string' || typeof message.sender === 'string')
  );
}

// Clear the in-memory cache when tabs are closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // When a tab is removed, we want to clear any conversation associated with its title.
  // This is a best-effort approach as tab titles can change.
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return; // Tab might already be gone
    const tabTitle = tab.title || 'Untitled Tab';
    // Iterate through stored conversations and remove those whose names match the closed tab's title
    // This assumes conversation name is often the tab title, which might not always be true,
    // but it's a reasonable heuristic for cleanup.
    for (const key in conversationsByTabTitle) {
      if (key === tabTitle) { // Check if the stored conversation key matches the closed tab's title
        delete conversationsByTabTitle[key];
        console.log('Cleared cached conversation for closed tab (by title match):', tabTitle);
      }
    }
    // Also, if the conversation was stored by its actual name, and that name was the tab title,
    // it will be cleared. If the tab title was generic "Claude", and the conversation had a specific name,
    // that specific conversation will remain. This is desired.
  });
});

// Periodically sync with chrome.storage to prevent memory leaks
setInterval(() => {
  chrome.storage.local.get('conversationsByTabTitle', (result) => {
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
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});
