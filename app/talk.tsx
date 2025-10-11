import Talk from "../components/Talk";

export default function TalkScreen() {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  return <Talk apiKey={apiKey} />;
}
