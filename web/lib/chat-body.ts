import { z } from "zod";
import { CHAT_FRAMES, parseLookChanges, REEL_FONTS, REEL_MAX_FONTS, REEL_STYLES, type ReelFont, type ReelStyle } from "@launchreel/core";

/**
 * An Ask AI request from the editor: the message, the playhead, what's picked (in words) and the draft (its options
 * checked here; its edit by parseReelEdit). Read by /api/reels/[id]/chat and, locally, /api/local/chat.
 */
export const ChatBody = z.object({
  message: z.string().trim().min(1).max(1000),
  time: z.number().min(0).default(0),
  // What the customer has picked in the editor (a word, a caption line, a shot, an effect, a stretch), in words.
  selection: z.string().trim().max(300).optional(),
  // The chat so far (the latest messages, checked again by cleanChatHistory), so "it", "more" and "undo that" make sense.
  history: z
    .array(z.object({ from: z.enum(["you", "ai"]), text: z.string(), answer: z.number().int().optional(), undone: z.boolean().optional() }))
    .max(40)
    .optional(),
  // Frames of the video for the assistant to look at (small JPEGs; checked again by cleanChatFrames).
  frames: z
    .array(z.object({ at: z.number(), image: z.string().max(CHAT_FRAMES.chars), playhead: z.boolean().optional() }))
    .max(CHAT_FRAMES.max)
    .optional(),
  draft: z.object({
    options: z.object({
      style: z.enum(REEL_STYLES as [ReelStyle, ...ReelStyle[]]),
      look: z.unknown().optional().transform((look) => parseLookChanges(look)),
      fonts: z
        .array(z.enum(REEL_FONTS as [ReelFont, ...ReelFont[]]))
        .min(1)
        .max(REEL_MAX_FONTS),
      emojis: z.boolean(),
      zooms: z.boolean(),
      sfx: z.boolean(),
      hook: z.boolean(),
      captions: z.boolean().optional(),
    }),
    edit: z.unknown(),
  }),
});

/** The reel's context with what's picked after it, so the assistant reads "this" and "here" as it (not the message). */
export const withSelection = (context: string, selection?: string) => (selection ? `${context}\nSelected in the editor: ${selection}. "This", "it" or "here" in the message most likely means it.` : context);
