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
          const jsonData = await response.json();
          console.log('Conversation data fetched successfully');

          // Store conversation for this tab title
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
        } catch (error) {
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