let conversationsByTabTitle = {};

document.getElementById('viewBtn').addEventListener('click', async () => {
  try {
    const storage = await chrome.storage.local.get('conversationsByTabTitle');
    conversationsByTabTitle = storage.conversationsByTabTitle || {};
    
    const statusEl = document.getElementById('status');
   
    // Filter out 'Claude' tab, if exists
    const filteredConversations = Object.fromEntries(
      Object.entries(conversationsByTabTitle).filter(([tabTitle]) => tabTitle !== 'Claude')
    );
   
    if (Object.keys(filteredConversations).length > 0) {
      // If multiple conversations, show a list
      let html = '<strong>Captured Conversations:</strong><br>';
      Object.entries(filteredConversations).forEach(([tabTitle, conversation]) => {
        html += `
          <div class="conversation-item" data-tab-title="${escapeHtml(tabTitle)}" style="cursor: pointer; padding: 5px; margin: 5px 0; border: 1px solid #ccc;">
            <strong>Tab: ${escapeHtml(tabTitle)}</strong><br>
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
    
    // If no conversations, show message
    if (Object.keys(conversationsByTabTitle).length === 0) {
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

    // Filter out 'Claude' tab, if exists
    const filteredConversations = Object.fromEntries(
      Object.entries(conversationsByTabTitle).filter(([tabTitle]) => tabTitle !== 'Claude')
    );

    // If no conversations left after filtering, show message
    if (Object.keys(filteredConversations).length === 0) {
      document.getElementById('status').innerHTML = `
        <div style="color: blue;">
          <strong>No downloadable conversations</strong><br>
          All captured conversations are from the "Claude" tab.
        </div>
      `;
      return;
    }

    // If multiple conversations, create a selection dialog
    if (Object.keys(filteredConversations).length > 1) {
      const statusEl = document.getElementById('status');
      let html = '<strong>Select a Conversation to Download:</strong><br>';
      
      Object.entries(filteredConversations).forEach(([tabTitle, conversation]) => {
        html += `
          <div class="download-option" data-tab-title="${escapeHtml(tabTitle)}" style="cursor: pointer; padding: 5px; margin: 5px 0; border: 1px solid #ccc;">
            <strong>Tab: ${escapeHtml(tabTitle)}</strong><br>
            URL: ${conversation.url}<br>
            Timestamp: ${conversation.timestamp}<br>
            <button class="select-download" data-tab-title="${escapeHtml(tabTitle)}">Download This Conversation</button>
          </div>
        `;
      });
      
      statusEl.innerHTML = html;

      // Add click events to download buttons
      document.querySelectorAll('.select-download').forEach(button => {
        button.addEventListener('click', function() {
          const tabTitle = this.getAttribute('data-tab-title');
          downloadConversation(tabTitle);
        });
      });
      
      return;
    }

    // If only one conversation left after filtering, download it
    if (Object.keys(filteredConversations).length === 1) {
      const firstTabTitle = Object.keys(filteredConversations)[0];
      downloadConversation(firstTabTitle);
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

function downloadConversation(tabTitle) {
  if (tabTitle === 'Claude') {
    document.getElementById('status').innerHTML = `
      <div style="color: blue;">
        <strong>Download Prevented</strong><br>
        Conversations from the "Claude" tab cannot be downloaded.
      </div>
    `;
    return;
  }
  
  const conversation = conversationsByTabTitle[tabTitle];
  
  if (conversation) {
    const jsonString = JSON.stringify(conversation.data);
    const printArtifacts = document.getElementById('printArtifacts').checked;
    const html = generateHtml(jsonString, printArtifacts);

    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_conversations_${conversation.timestamp.replace(/:/g, '-')}_${encodeURIComponent(tabTitle)}.html`;
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