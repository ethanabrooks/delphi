import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

/**
 * Generic template loader with interpolation
 * Simple template substitution using {{placeholder}} syntax.
 */
async function loadTemplate(
  requireModule: number,
  variables: Record<string, string>
): Promise<string> {
  // Load the template file as an asset
  const asset = Asset.fromModule(requireModule);

  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error("Failed to load prompt template");
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

/**
 * Reads and interpolates the system prompt template.
 */
export async function readSystemPromptTemplate(
  variables: Record<string, string>
): Promise<string> {
  return loadTemplate(
    require("../prompts/conversation-agent-system-prompt.txt"),
    variables
  );
}

/**
 * Reads and interpolates the conversation summarization prompt template.
 */
export async function readSummarizationPromptTemplate(
  variables: Record<string, string>
): Promise<string> {
  return loadTemplate(
    require("../prompts/conversation-summarization-prompt.txt"),
    variables
  );
}
