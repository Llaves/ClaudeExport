let conversationsByTabTitle = {};

document.getElementById('viewBtn').addEventListener('click', async () => {
  try {
    const storage = await chrome.storage.local.get('conversationsByTabTitle');
    conversationsByTabTitle = storage.conversationsByTabTitle || {};
    
    const statusEl = document.getElementById('status');
   
    // No longer filtering by 'Claude' tab title, as conversations are stored by their actual names
    const availableConversations = conversationsByTabTitle;
   
    if (Object.keys(availableConversations).length > 0) {
      // If multiple conversations, show a list
      let html = '<strong>Captured Conversations:</strong><br>';
      Object.entries(availableConversations).forEach(([conversationName, conversation]) => {
        html += `
          <div class="conversation-item" data-tab-title="${escapeHtml(conversationName)}" style="cursor: pointer; padding: 5px; margin: 5px 0; border: 1px solid #ccc;">
            <strong>Conversation: ${escapeHtml(conversationName)}</strong><br>
            URL: ${conversation.url}<br>
            Timestamp: ${conversation.timestamp}<br>
          </div>
        `;
      });
      statusEl.innerHTML = html;
    } else {
      statusEl.innerHTML = `
        <div style="color: blue;">
          <strong>No conversation captured yet</strong><br>
          <br>
          To capture a conversation:
          <ul>
            <li>Navigate to a page with a URL containing "chat_conversations/"</li>
            <li>Ensure the page loads completely</li>
            <li>The extension will automatically try to capture the JSON</li>
          </ul>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error viewing conversation:', error);
    document.getElementById('status').textContent = `Error: ${error.message}`;
  }
});

document.getElementById('downloadBtn').addEventListener('click', async () => {
  try {
    // Retrieve conversations again to ensure we have the latest
    const storage = await chrome.storage.local.get('conversationsByTabTitle');
    conversationsByTabTitle = storage.conversationsByTabTitle || {};
    
    // No longer filtering by 'Claude' tab title
    const availableConversations = conversationsByTabTitle;

    // If no conversations, show message
    if (Object.keys(availableConversations).length === 0) {
      document.getElementById('status').innerHTML = `
        <div style="color: blue;">
          <strong>No conversation to download</strong><br>
          <br>
          To capture a conversation:
          <ul>
            <li>Navigate to a page with a URL containing "chat_conversations/"</li>
            <li>Ensure the page loads completely</li>
            <li>The extension will automatically try to capture the JSON</li>
          </ul>
        </div>
      `;
      return;
    }

    // If multiple conversations, create a selection dialog
    if (Object.keys(availableConversations).length > 1) {
      const statusEl = document.getElementById('status');
      let html = '<strong>Select a Conversation to Download:</strong><br>';
      
      Object.entries(availableConversations).forEach(([conversationName, conversation]) => {
        html += `
          <div class="download-option" data-tab-title="${escapeHtml(conversationName)}" style="cursor: pointer; padding: 5px; margin: 5px 0; border: 1px solid #ccc;">
            <strong>Conversation: ${escapeHtml(conversationName)}</strong><br>
            URL: ${conversation.url}<br>
            Timestamp: ${conversation.timestamp}<br>
            <button class="select-download" data-tab-title="${escapeHtml(conversationName)}">Download This Conversation</button>
          </div>
        `;
      });
      
      statusEl.innerHTML = html;

      // Add click events to download buttons
      document.querySelectorAll('.select-download').forEach(button => {
        button.addEventListener('click', function() {
          const conversationName = this.getAttribute('data-tab-title');
          downloadConversation(conversationName);
        });
      });
      
      return;
    }

    // If only one conversation, download it directly
    if (Object.keys(availableConversations).length === 1) {
      const firstConversationName = Object.keys(availableConversations)[0];
      downloadConversation(firstConversationName);
    }
  } catch (error) {
    console.error('Error preparing download:', error);
    document.getElementById('status').textContent = `Error: ${error.message}`;
  }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove('conversationsByTabTitle');
    conversationsByTabTitle = {};
    
    document.getElementById('status').innerHTML = `
      <div style="color: green;">
        <strong>Conversations Cleared</strong><br>
        All captured conversations have been removed.
      </div>
    `;
  } catch (error) {
    console.error('Error clearing conversations:', error);
    document.getElementById('status').textContent = `Error: ${error.message}`;
  }
});

// When the popup loads, restore the checkbox state
document.addEventListener('DOMContentLoaded', async () => {
  const checkbox = document.getElementById('printArtifacts');
  const storage = await chrome.storage.local.get('printArtifactsEnabled');
  checkbox.checked = storage.printArtifactsEnabled || false;
});

// When the checkbox changes, save its state
document.getElementById('printArtifacts').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ printArtifactsEnabled: e.target.checked });
});

function downloadConversation(conversationName) {
  // The 'Claude' tab title check is removed here as conversations are now stored by their actual names.
  // If a conversation's name happens to be 'Claude', it can still be downloaded.
  
  const conversation = conversationsByTabTitle[conversationName];
  
  if (conversation) {
    const jsonString = JSON.stringify(conversation.data);
    const printArtifacts = document.getElementById('printArtifacts').checked;
    // The generateHtml function is imported via html-converter.js
    const html = generateHtml(jsonString, printArtifacts);

    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    // Use conversationName in the filename
    a.download = `chat_conversations_${conversation.timestamp.replace(/:/g, '-')}_${encodeURIComponent(conversationName)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    document.getElementById('status').innerHTML = '';
  }
}

// Utility function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
