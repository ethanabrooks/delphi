import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

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

  let template: string;

  if (Platform.OS === "web") {
    // On web, use fetch to load the asset via HTTP
    if (!asset.uri) {
      throw new Error("Failed to load prompt template - no URI");
    }
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    template = await response.text();
  } else {
    // On native platforms, use FileSystem
    if (!asset.localUri) {
      throw new Error("Failed to load prompt template - no localUri");
    }
    template = await FileSystem.readAsStringAsync(asset.localUri);
  }

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
