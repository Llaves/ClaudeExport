import json
import re
import html
import datetime
import math
import sys
import os

type_lookup = {
  "application/vnd.ant.react": "jsx",
  "text/html": "html"
}

def escape_html(text):
    """Escapes HTML special characters."""
    return html.escape(text, quote=True)

def replace_inline_code(text):
    """Replaces inline code blocks with HTML tags."""

    # Handle triple backticks code blocks
    text = re.sub(r"```(\w*)\n([\s\S]*?)```",
                  lambda match: f'<pre class="code-block {match.group(1)}">{escape_html(match.group(2))}</pre>',
                  text)

    # Handle inline code with single backticks
    text = re.sub(r"`([^`]+)`",
                  lambda match: f'<code class="inline-code">{escape_html(match.group(1))}</code>',
                  text)

    # Process nested numbered lists
    def process_nested_numbered_list(text):
        lines = text.split('\n')
        root_list = {'items': [], 'type': 'ol', 'class': 'numbered-list'}
        stack = [root_list]
        current_indent_level = 0

        # Helper function to get indent level
        def get_indent_level(line):
            match = re.match(r'^(\s*)\d+\.', line)
            return math.floor(len(match[1]) / 3) if match else 0

        # Helper function to create HTML
        def create_list_html(lst):
            items = [item if isinstance(item, str) else f'<{item["type"]} class="{item["class"]}">{create_list_html(item)}</{item["type"]}>' for item in lst['items']]
            return '\n'.join(items)

        for line in lines:
            # Skip empty lines
            if not line.strip():
                continue

            # Check if line is a numbered item
            number_match = re.match(r'^(\s*)(\d+)\.\s+(.+)$', line)
            if not number_match:
                continue

            indent, number, content = number_match.groups()
            indent_level = get_indent_level(line)

            # Create list item HTML with value attribute
            list_item = f'<li value="{number}">{content.strip()}</li>'

            # Handle indentation changes
            if indent_level > current_indent_level:
                # Create new nested list
                new_list = {'items': [list_item], 'type': 'ol', 'class': 'numbered-list'}
                # Add the new list to the last item of the parent list
                parent_list = stack[-1]
                if isinstance(parent_list['items'][-1], str):
                    # Convert the last string item to contain the nested list
                    last_item = parent_list['items'][-1]
                    parent_list['items'][-1] = last_item.replace('</li>', '')
                    parent_list['items'].append(new_list)
                    parent_list['items'].append('</li>')
                stack.append(new_list)
            elif indent_level < current_indent_level:
                # Pop lists from stack until we reach the correct level
                while current_indent_level > indent_level and len(stack) > 1:
                    stack.pop()
                    current_indent_level -= 1
                stack[-1]['items'].append(list_item)
            else:
                # Same level, just add the item
                stack[-1]['items'].append(list_item)

            current_indent_level = indent_level

        return f'<ol class="numbered-list">{create_list_html(root_list)}</ol>'

    # Find all numbered list sections and process them
    text = re.sub(r'(?:^|\n)(?:\s*\d+\.\s+.+(?:\n|$))+',
                  lambda match: f'\n{process_nested_numbered_list(match.group(0).strip())}\n',
                  text, flags=re.MULTILINE)

    # Process nested bullet lists
    def process_nested_list(text):
        lines = text.split('\n')
        root_list = {'items': [], 'type': 'ul', 'class': 'bulleted-list'}
        stack = [root_list]
        current_indent_level = 0

        # Helper function to get indent level
        def get_indent_level(line):
            match = re.match(r'^(\s*)([-*])', line)
            return math.floor(len(match[1]) / 2) if match else 0

        # Helper function to create HTML
        def create_list_html(lst):
            items = [item if isinstance(item, str) else f'<{item["type"]} class="{item["class"]}">{create_list_html(item)}</{item["type"]}>' for item in lst['items']]
            return '\n'.join(items)

        for line in lines:
            # Skip empty lines
            if not line.strip():
                continue

            # Check if line is a bullet point
            bullet_match = re.match(r'^(\s*)([-*])\s+(.+)$', line)
            if not bullet_match:
                continue

            indent, bullet, content = bullet_match.groups()
            indent_level = get_indent_level(line)

            # Create list item HTML
            list_item = f'<li>{content.strip()}</li>'

            # Handle indentation changes
            if indent_level > current_indent_level:
                # Create new nested list
                new_list = {'items': [list_item], 'type': 'ul', 'class': 'bulleted-list'}
                # Add the new list to the last item of the parent list
                parent_list = stack[-1]
                if isinstance(parent_list['items'][-1], str):
                    # Convert the last string item to contain the nested list
                    last_item = parent_list['items'][-1]
                    parent_list['items'][-1] = last_item.replace('</li>', '')
                    parent_list['items'].append(new_list)
                    parent_list['items'].append('</li>')
                stack.append(new_list)
            elif indent_level < current_indent_level:
                # Pop lists from stack until we reach the correct level
                while current_indent_level > indent_level and len(stack) > 1:
                    stack.pop()
                    current_indent_level -= 1
                stack[-1]['items'].append(list_item)
            else:
                # Same level, just add the item
                stack[-1]['items'].append(list_item)

            current_indent_level = indent_level

        return f'<ul class="bulleted-list">{create_list_html(root_list)}</ul>'

    # Find all bullet list sections and process them
    text = re.sub(r'(?:^|\n)(?:[-*]\s+.+\n?)+',
                  lambda match: f'\n{process_nested_list(match.group(0).strip())}\n',
                  text, flags=re.DOTALL)

    return text


artifact_counter = 0

def replace_artifact_tags(input_text, artifact_panels, print_artifacts=False):
    """Replaces artifact tags with HTML elements."""
    global artifact_counter

    def extract_attributes(tag):
        attributes = {}
        attr_regex = r'(\w+)=("([^"]*)"|\'([^\']*)\')'
        for match in re.finditer(attr_regex, tag):
            key = match.group(1)
            value = match.group(3) or match.group(4)
            attributes[key] = value
        return attributes

    def create_artifact_panel(artifact_id, title, content, lang):
        artifact_panels.append(f"""
          <div class="artifact-panel" id="{artifact_id}">
            <div class="artifact-panel-header">
              <h3>{title}</h3>
              <button class="close-panel" aria-label="Close panel">&times;</button>
            </div>
            <div class="artifact-panel-content">
              <pre class="code-block {lang}">{escape_html(content)}</pre>
            </div>
          </div>
        """)

    def replace_match(match):
        global artifact_counter
        full_match = match.group(0)
        content = match.group(1)
        has_closing_tag = match.group(2) == "</antArtifact>"
        opening_tag = full_match[:full_match.find('>') + 1]
        attributes = extract_attributes(opening_tag)
        lang = attributes.get('language', type_lookup.get(attributes.get('type'), ""))
        artifact_id = f"artifact-{artifact_counter}"
        title = attributes.get('title', "Untitled")

        if not has_closing_tag:
            content += "\n\n\n THIS ARTIFACT IS INCOMPLETE BECAUSE THE MAX MESSAGE LENGTH WAS EXCEEDED."

        create_artifact_panel(artifact_id, title, content, lang)
        artifact_counter += 1

        return f"""
          <div class="artifact-wrapper">
            <p class="artifact-button-wrapper {'print-enabled' if print_artifacts else ''}">
              <button class="artifact-button" data-artifact-id="{artifact_id}">
                <svg class="artifact-icon" width="16" height="16" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
                </svg>
                <span class="artifact-title">{title}</span>
              </button>
            </p>
            <div class="artifact-inline {'print-enabled' if print_artifacts else ''}">
              <h4>{title}</h4>
              <pre class="code-block {lang}">{escape_html(content)}</pre>
            </div>
          </div>
        """

    pattern = r'<antArtifact[^>]*>([\s\S]*?)(<\/antArtifact>|$)'
    result = re.sub(pattern, replace_match, input_text)
    return result


def generate_html(json_data, print_artifacts=False):
    """Generates HTML from the given JSON data."""
    try:
        parsed = json.loads(json_data)
        if not parsed or "chat_messages" not in parsed:
            return ""
    except json.JSONDecodeError:
        return ""

    artifact_panels = []

    messages = ""
    for message in parsed["chat_messages"]:
        message_content = ""
        for content in message["content"]:
            if content.get("type") == "tool_use" and content.get("name") == "repl":
                artifact_id = f"repl-{content['id']}"
                artifact_panels.append(f"""
                  <div class="artifact-panel" id="{artifact_id}">
                    <div class="artifact-panel-header">
                      <h3>Analysis</h3>
                      <button class="close-panel" aria-label="Close panel">&times;</button>
                    </div>
                    <div class="artifact-panel-content">
                      <pre class="code-block javascript">{escape_html(content["input"]["code"].strip())}</pre>
                    </div>
                  </div>
                """)
                message_content += f"""
                    <div class="artifact-wrapper">
                      <p class="artifact-button-wrapper {'print-enabled' if print_artifacts else ''}">
                        <button class="artifact-button" data-artifact-id="{artifact_id}">
                          <svg class="artifact-icon" width="16" height="16" viewBox="0 0 16 16">
                            <path fill="currentColor" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
                          </svg>
                          <span class="artifact-title">Analysis</span>
                        </button>
                      </p>
                      <div class="artifact-inline {'print-enabled' if print_artifacts else ''}">
                        <h4>Analysis</h4>
                        <pre class="code-block javascript">{escape_html(content["input"]["code"].strip())}</pre>
                      </div>
                    </div>
                  """
            elif content.get("text"):
                processed_text = replace_artifact_tags(content["text"], artifact_panels, print_artifacts)
                processed_text = replace_inline_code(processed_text)
                message_content += processed_text
            else:
                message_content += escape_html(json.dumps(content))

        timestamp =  datetime.datetime.fromisoformat(message["created_at"].replace('Z', '+00:00')).strftime("%b %d, %Y %I:%M %p")

        message_class = message["sender"].lower()

        messages += f"""
          <div class="message {message_class}">
            <div class="message-header">
              <span class="sender">{escape_html(message["sender"])}</span>
              <span class="timestamp">{timestamp}</span>
            </div>
            <div class="message-content">
              {message_content}
            </div>
          </div>
        """

    style_sheet = """
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            display: flex;
            justify-content: center;
          }
          .chat-container {
            flex: 0 1 1000px;
            padding: 20px;
            transition: max-width 0.3s ease;
          }
          .container.has-panel .chat-container {
            flex: 0 1 1000px;
          }
          .artifact-container {
            width: 0;
            background: white;
            border-left: 1px solid #e5e7eb;
            transition: width 0.3s ease;
            overflow: hidden;
            flex-shrink: 0;
            position: sticky;
            top: 0;
            height: 100vh;
          }
          .artifact-container.active {
            width: 800px;
          }
          .conversation-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #111827;
          }
          .message {
            margin-bottom: 24px;
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }
          .sender {
            font-weight: 600;
            color: #111827;
            margin-right: 12px;
          }
          .timestamp {
            color: #6b7280;
            font-size: 0.875rem;
          }
          .message-content {
            color: #1f2937;
          }

          .artifact-button-wrapper {
            margin: 1em 0;
          }
          .artifact-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background-color: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            color: #374151;
            transition: background-color 0.2s;
          }
          .artifact-button:hover {
            background-color: #e5e7eb;
          }
          .artifact-icon {
            width: 16px;
            height: 16px;
          }
          .artifact-panel {
            display: none;
            height: 100%;
            flex-direction: column;
          }
          .artifact-panel.active {
            display: flex;
          }
          .artifact-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
          }
          .artifact-panel-header h3 {
            margin: 0;
            font-size: 16px;
            color: #111827;
          }
          .close-panel {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            padding: 0 8px;
          }
          .close-panel:hover {
            color: #111827;
          }
          .artifact-panel-content {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
          }
          .code-block {
            margin: 0;
            padding: 12px;
            background: #f8fafc;
            overflow-x: auto;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 0.875rem;
            white-space: pre-wrap;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          .inline-code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 0.875rem;
            background: #f3f4f6;
            padding: 2px 4px;
            border-radius: 4px;
          }
          .human {
            background: #f3f4f6;
          }
          .assistant {
            background: white;
            font-family: "Times New Roman", Times, serif;
            font-size: 110%;
          }

          /* New styles for inline artifacts */
          .artifact-inline {
            display: none;
            margin: 1em 0;
            padding: 1em;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
          }

          .artifact-inline h4 {
            margin: 0 0 1em 0;
            color: #111827;
          }

          .artifact-inline.print-enabled {
            display: none; /* Still hidden in normal view */
          }

          @media print {
            .artifact-button-wrapper {
              display: none; /* Hide all artifact buttons when printing */
            }
            .artifact-inline.print-enabled {
              display: block; /* Only show artifacts that are print-enabled */
            }
            .artifact-inline:not(.print-enabled) {
              display: none; /* Explicitly hide non-print-enabled artifacts */
            }
          }

      .numbered-list {
        margin: 16px 0;
        padding-left: 40px;
      }

      .numbered-list li {
        margin-bottom: 8px;
      }

      .bulleted-list {
        margin: 16px 0;
        padding-left: 40px;
        list-style-type: disc;
      }

      .bulleted-list .bulleted-list {
        margin: 8px 0 8px 0;
        list-style-type: circle;
      }

      .bulleted-list .bulleted-list .bulleted-list {
        list-style-type: square;
      }

      .bulleted-list li {
        margin-bottom: 8px;
      }
          @media print {
            body {
              background-color: white;
            }
            .container {
              display: block;
            }
            .chat-container {
              max-width: 100%;
              padding: 0;
            }
            .artifact-container {
              display: none;
            }
            .artifact-button-wrapper.print-enabled {
              display: none;
            }
            .artifact-inline.print-enabled {
              display: block;
            }
          }
        </style>
      """

    script = """
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const container = document.querySelector('.container');
          const artifactContainer = document.querySelector('.artifact-container');
          const artifactPanels = document.querySelectorAll('.artifact-panel');
          const artifactButtons = document.querySelectorAll('.artifact-button');
          const closePanelButtons = document.querySelectorAll('.close-panel');

          let currentPanelId = null;

          function hideAllPanels() {
            artifactPanels.forEach(panel => {
              panel.classList.remove('active');
          });
            artifactContainer.classList.remove('active');
            container.classList.remove('has-panel');
            currentPanelId = null;
          }

          function showPanel(panelId) {
            // First hide all panels
            artifactPanels.forEach(panel => {
              panel.classList.remove('active');
            });

            // Show the selected panel
            const panel = document.getElementById(panelId);
            if (panel) {
              panel.classList.add('active');
              artifactContainer.classList.add('active');
              container.classList.add('has-panel');
              currentPanelId = panelId;
            }
          }

          artifactButtons.forEach(button => {
            button.addEventListener('click', () => {
              const artifactId = button.dataset.artifactId;

              // If clicking the same button that's currently shown, hide it
              if (artifactId === currentPanelId) {
                hideAllPanels();
              } else {
                // If clicking a different button, show its content
                showPanel(artifactId);
              }
            });
          });

          closePanelButtons.forEach(button => {
            button.addEventListener('click', hideAllPanels);
          });

        });
      </script>
    """

    html_output = f"""
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{escape_html(parsed["name"])}</title>
        {style_sheet}
      </head>
      <body>
        <div class="container">
          <div class="chat-container">
            <div class="conversation-title">{escape_html(parsed["name"])}</div>
            {messages}
          </div>
          <div class="artifact-container">
            {"".join(artifact_panels)}
          </div>
        </div>
        {script}
      </body>
      </html>
    """

    return html_output

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <input_file.json>")
        sys.exit(1)

    input_file_path = sys.argv[1]
    base_name = os.path.splitext(input_file_path)[0]
    output_file_path = base_name + ".html"

    try:
        with open(input_file_path, 'r', encoding='utf-8') as file:
            json_data = file.read()

        html_output = generate_html(json_data, print_artifacts=False)

        with open(output_file_path, "w", encoding="utf-8") as output_file:
            output_file.write(html_output)

        print(f"HTML output saved to {output_file_path}")

    except FileNotFoundError:
        print(f"Error: Input file not found: {input_file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)