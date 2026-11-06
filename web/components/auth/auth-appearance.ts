import type { SignIn } from "@clerk/nextjs";

type Appearance = NonNullable<React.ComponentProps<typeof SignIn>["appearance"]>;

/**
 * Clerk's sign-in and sign-up forms, dressed for the always-dark auth pages (auth-shell.tsx): no card or header of
 * their own (the page has the heading), a white Google button, quiet inputs and a grey Continue. Style objects, not
 * Tailwind classes, because Clerk's own CSS-in-JS would win over our utility layer.
 */
export const authAppearance: Appearance = {
  variables: {
    colorPrimary: "#26262a", // Continue and focus rings: grey, as the page has no accent of its own
    colorBackground: "#08080a",
    colorText: "#ededed",
    colorTextSecondary: "#8f8f95",
    colorInputBackground: "#141416",
    colorInputText: "#ededed",
    colorNeutral: "#ffffff",
    colorDanger: "#ff7a7a",
    borderRadius: "10px",
    fontSize: "14px",
  },
  layout: { socialButtonsPlacement: "top", socialButtonsVariant: "blockButton" },
  captcha: { theme: "dark", size: "flexible" }, // Clerk's "Verify you are human" box, dark like the page
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "none", background: "transparent" },
    card: { width: "100%", background: "transparent", boxShadow: "none", border: "none", padding: 0, gap: "20px" },
    header: { display: "none" },
    socialButtonsBlockButton: {
      height: "42px",
      background: "#ffffff",
      border: "none",
      boxShadow: "none",
      "&:hover": { background: "#e8e8ea" },
    },
    socialButtonsBlockButtonText: { color: "#0a0a0a", fontSize: "15px", fontWeight: 500 },
    dividerLine: { background: "rgba(255,255,255,0.1)" },
    dividerText: { color: "#6b6b72", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" },
    formFieldLabel: { color: "#a1a1a8", fontSize: "13px", fontWeight: 400 },
    formFieldHintText: { display: "none" }, // "Optional" by the name fields (Taibanaz, 6 Nov)
    formFieldInput: {
      height: "44px",
      background: "#141416",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "none",
      color: "#ededed",
      "&:focus": { borderColor: "rgba(255,255,255,0.28)", boxShadow: "none" },
    },
    formButtonPrimary: {
      height: "42px",
      background: "#232326",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "none",
      color: "#ffffff",
      fontSize: "15px",
      fontWeight: 500,
      textTransform: "none",
      "&:hover": { background: "#2c2c30" },
      backgroundImage: "none",
      "&:focus": { boxShadow: "none" },
      "&::after": { display: "none" },
      "& svg": { display: "none" },
    },
    footer: { background: "transparent", backgroundImage: "none", alignItems: "stretch" },
    footerAction: { justifyContent: "flex-start", width: "100%", paddingLeft: 0, paddingRight: 0 },
    footerActionText: { color: "#8f8f95", fontSize: "14px" },
    footerActionLink: {
      color: "#ffffff",
      fontSize: "14px",
      fontWeight: 500,
      textDecoration: "underline",
      textUnderlineOffset: "3px",
      "&:hover": { color: "#C8F135" },
    },
  },
};
