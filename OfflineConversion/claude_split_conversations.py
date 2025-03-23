import json
import os
import sys

def split_claude_json(input_file):
    """
    Reads a Claude chat archive JSON file, splits it into multiple JSON files,
    one for each conversation with content in the input file,
    and names the output files using the conversation name.
    """

    deleted_count = 0  # Initialize count of deleted conversations

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in '{input_file}': {e}")
        return

    if not isinstance(data, list):
        print("Error: The JSON data should be a list of conversations.")
        return

    for conversation in data:
        if not isinstance(conversation, dict):
            print("Warning: Found a non-dictionary element in the conversation list. Skipping.")
            continue

        # Check for content. Conversations without chat_messages or an empty name are considered deleted
        if ("chat_messages" not in conversation or
            not isinstance(conversation["chat_messages"], list) or
            not conversation["chat_messages"]) or \
           ("name" in conversation and
            isinstance(conversation["name"], str) and
            conversation["name"] == ""):

            deleted_count += 1
            continue  # Skip to the next conversation

        if "name" not in conversation or not isinstance(conversation["name"], str):
            print("Warning: Conversation missing 'name' or 'name' is not a string. Using a generic filename.")
            output_filename = f"conversation_{data.index(conversation) + 1}.json"
        else:
            conversation_name = conversation["name"]
            # Sanitize the conversation name to create a valid filename
            filename = "".join(c for c in conversation_name if c.isalnum() or c in "._- ")
            filename = filename.strip()  # Remove leading/trailing whitespace
            if not filename:  # if filename is empty after sanitization
                filename = f"conversation_{data.index(conversation) + 1}"  # Use generic name
            output_filename = f"{filename}.json"

        # Create the output path by combining the output directory and the filename
        output_path = output_filename

        try:
            with open(output_path, "w", encoding="utf-8") as outfile:
                json.dump(conversation, outfile, indent=2, ensure_ascii=False)
            print(f"Successfully wrote conversation to '{output_path}'")
        except Exception as e:
            print(f"Error writing to '{output_path}': {e}")

    print(f"\nFound and skipped {deleted_count} deleted (empty) conversations.")  # Print total count


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python split_json.py <input_file.json>")
    else:
        input_file = sys.argv[1]
        split_claude_json(input_file)