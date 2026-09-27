// Every dashboard page is rendered per request, so no incremental (ISR) cache is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
