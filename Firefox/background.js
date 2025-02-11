// Track conversations by tab title
const conversationsByTabTitle = {};

browser.webRequest.onCompleted.addListener(
  async (details) => {
    console.log('Web request completed:', details.url);

    // Check if the URL contains chat_conversations/
    if (details.url.includes('chat_conversations/') 
         && !details.url.includes('latest')
        && !details.url.includes('/chat_message_warning')) {
      
      console.log('Matching conversation URL detected');

      // Get the active tab details
      const tabs = await browser.tabs.query({active: true, currentWindow: true});
      if (tabs[0]) {
        const tabTitle = tabs[0].title || 'Untitled Tab';

        // Fetch the conversation
        try {
          const response = await fetch(details.url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const textData = await response.text();

          let jsonData;
          try {
            jsonData = JSON.parse(textData);
            console.log('Conversation data fetched successfully');

            // Only proceed with storage if JSON parsing succeeded
            conversationsByTabTitle[tabTitle] = {
              url: details.url,
              timestamp: new Date().toISOString(),
              data: jsonData
            };

            // Store in browser storage
            await browser.storage.local.set({ 
              conversationsByTabTitle: conversationsByTabTitle 
            });
            console.log('Conversations stored in local storage');
          } 
          catch (jsonError) {
            console.warn('Invalid JSON response, ignoring:', jsonError);
            return; // Exit early if JSON parsing fails
          } 
        }
        catch (error) {
          console.error('Fetch or storage error:', error);
        }
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Extension installation listener
browser.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});