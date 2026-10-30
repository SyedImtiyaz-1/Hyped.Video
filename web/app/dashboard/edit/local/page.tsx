import type { Metadata } from "next";
import { LocalEditor } from "./local-editor";

export const metadata: Metadata = { title: "Editor" };

/** The editor on a clip from this computer, before (or, in demo mode, instead of) uploading it (local-editor.tsx). */
export default function LocalEditorPage() {
  return <LocalEditor />;
}
