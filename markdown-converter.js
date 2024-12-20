// Shared markdown conversion utility

// This code is copied almost entirely from Simon Willison's converter on ObservablesHQ 
//   https://observablehq.com/@simonw/convert-claude-json-to-markdown

const typeLookup = {
  "application/vnd.ant.react": "jsx",
  "text/html": "html"
};

function parser(input) {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (match) {
    const entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entityMap[match];
  });
}

function replaceArtifactTags(input) {
  // Regular expression to match <antArtifact> tags
  const regex = /<antArtifact[^>]*>/g;

  // Function to extract attributes from a tag string
  function extractAttributes(tag) {
    const attributes = {};
    const attrRegex = /(\w+)=("([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = attrRegex.exec(tag)) !== null) {
      const key = match[1];
      const value = match[3] || match[4]; // Use either double or single quotes
      attributes[key] = value;
    }
    return attributes;
  }

  return input.replace(regex, (match) => {
    const attributes = extractAttributes(match);
    // Determine language based on 'language' attribute, otherwise fallback logic
    const lang = attributes.language || typeLookup[attributes.type] || "";

    // Return the Markdown formatted string
    return `### ${attributes.title || "Untitled"}\n\n\`\`\`${lang}`;
  });
}

function markdown(input) {
  const parsed = parser(input);
  if (!parsed.chat_messages) {
    return "";
  }
  const bits = [];
  bits.push(`# ${parsed.name}`);
  parsed.chat_messages.forEach((message) => {
    console.log({ message });
    bits.push(
      `**${message.sender}** (${new Date(message.created_at).toLocaleString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      )})`
    );
    message.content.forEach((content) => {
      if (content.type == "tool_use") {
        if (content.name == "repl") {
          bits.push(
            "**Analysis**\n```" +
              `javascript\n${content.input.code.trim()}` +
              "\n```"
          );
        } else if (content.name == "artifacts") {
          let lang =
            content.input.language || typeLookup[content.input.type] || "";
          // It's an artifact, but is it a create/rewrite/update?
          const input = content.input;
          if (input.command == "create" || input.command == "rewrite") {
            bits.push(
              `#### ${input.command} ${
                content.input.title || "Untitled"
              }\n\n\`\`\`${lang}\n${content.input.content}\n\`\`\``
            );
          } else if (input.command == "update") {
            bits.push(
              `#### update ${content.input.id}\n\nFind this:\n\`\`\`\n${content.input.old_str}\n\`\`\`\nReplace with this:\n\`\`\`\n${content.input.new_str}\n\`\`\``
            );
          }
        }
      } else if (content.type == "tool_result") {
        if (content.name != "artifacts") {
          let logs = JSON.parse(content.content[0].text).logs;
          bits.push(
            `**Result**\n<pre style="white-space: pre-wrap">\n${logs.join(
              "\n"
            )}\n</pre>`
          );
        }
      } else {
        if (content.text) {
          bits.push(
            replaceArtifactTags(
              content.text.replace(/<\/antArtifact>/g, "\n```")
            )
          );
        } else {
          bits.push(JSON.stringify(content));
        }
      }
    });
    const backtick = String.fromCharCode(96);
    message.attachments.forEach((attachment) => {
      bits.push(`<details><summary>${attachment.file_name}</summary>`);
      bits.push("\n\n");
      bits.push(backtick.repeat(5));
      bits.push(attachment.extracted_content);
      bits.push(backtick.repeat(5));
      bits.push("</details>");
    });
  });
  return bits.join("\n\n");
}
