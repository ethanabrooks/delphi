import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

/**
 * Reads and interpolates a system prompt template.
 * Simple template substitution using {{placeholder}} syntax.
 */
export async function readSystemPromptTemplate(
  variables: Record<string, string>
): Promise<string> {
  // Load the template file as an asset
  const asset = Asset.fromModule(
    require("../prompts/conversation-agent-system-prompt.txt")
  );

  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Failed to load system prompt template");
  }

  // Read the template content
  const template = await FileSystem.readAsStringAsync(asset.localUri);

  // Simple template interpolation
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  return result;
}
